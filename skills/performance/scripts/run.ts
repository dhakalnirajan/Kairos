#!/usr/bin/env bun
/**
 * performance/scripts/run.ts
 *
 * Two modes: --measure times a shell command across N runs; --scan does
 * static anti-pattern detection (N+1 queries, sync I/O in handlers,
 * unbounded fetches). Mutually exclusive.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

interface PerfArgs {
  measure?: string;
  runs: number;
  scan?: string;
}

interface Finding {
  file: string;
  line: number;
  pattern: "n-plus-one" | "sync-io-in-handler" | "unbounded-fetch";
  note: string;
}

function parseCliArgs(): PerfArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      measure: { type: "string" },
      runs: { type: "string", default: "3" },
      scan: { type: "string" },
    },
  });

  if (!values.measure && !values.scan) {
    console.error("Error: one of --measure or --scan is required");
    process.exit(1);
  }
  if (values.measure && values.scan) {
    console.error("Error: --measure and --scan are mutually exclusive");
    process.exit(1);
  }

  return {
    measure: values.measure as string | undefined,
    runs: parseInt((values.runs as string) ?? "3", 10),
    scan: values.scan as string | undefined,
  };
}

function runMeasure(command: string, runs: number) {
  const timings: number[] = [];
  // First run is warmup and discarded.
  spawnSync(command, { shell: true });
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    spawnSync(command, { shell: true });
    timings.push(performance.now() - start);
  }
  const minMs = Math.min(...timings);
  const maxMs = Math.max(...timings);
  const meanMs = timings.reduce((a, b) => a + b, 0) / timings.length;
  console.log(JSON.stringify({ command, runs, minMs: round2(minMs), maxMs: round2(maxMs), meanMs: round2(meanMs) }, null, 2));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function collectFiles(scope: string): string[] {
  const st = statSync(scope);
  if (st.isFile()) return [scope];
  const acc: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if ([".git", "node_modules", "dist", "build"].includes(entry)) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

const QUERY_CALL_RE = /\b(query|find|findOne|findAll|select|fetch|get)\s*\(/i;
const LOOP_OPEN_RE = /\b(for\s*\(|forEach\s*\(|\.map\s*\(|while\s*\()/;
const SYNC_IO_RE = /\b(readFileSync|writeFileSync|execSync|readdirSync)\s*\(/;
const HANDLER_PATH_RE = /(route|handler|controller)/i;
const UNBOUNDED_FETCH_RE = /\.(find|findAll|select)\s*\(\s*\)/; // no args = no filter/limit

function scanFile(file: string): Finding[] {
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const lines = source.split("\n");
  const findings: Finding[] = [];

  // N+1: track loop depth via brace counting; flag query calls while depth > 0.
  let loopDepth = 0;
  let braceStack: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (LOOP_OPEN_RE.test(line)) {
      loopDepth++;
      braceStack.push((line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length);
    } else if (loopDepth > 0) {
      const delta = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceStack.length > 0) {
        braceStack[braceStack.length - 1] += delta;
        if (braceStack[braceStack.length - 1] <= 0) {
          braceStack.pop();
          loopDepth = Math.max(0, loopDepth - 1);
        }
      }
    }
    if (loopDepth > 0 && QUERY_CALL_RE.test(line)) {
      findings.push({
        file,
        line: i + 1,
        pattern: "n-plus-one",
        note: "Query/fetch-like call appears inside a loop body — likely N+1. Consider batching before the loop.",
      });
    }
    if (SYNC_IO_RE.test(line) && HANDLER_PATH_RE.test(file)) {
      findings.push({
        file,
        line: i + 1,
        pattern: "sync-io-in-handler",
        note: "Synchronous I/O call in a file that looks like a request handler — blocks the event loop under load.",
      });
    }
    if (UNBOUNDED_FETCH_RE.test(line)) {
      findings.push({
        file,
        line: i + 1,
        pattern: "unbounded-fetch",
        note: "Collection fetch with no visible filter/limit arguments — confirm this can't return an unbounded result set.",
      });
    }
  }
  return findings;
}

function runScan(scope: string) {
  const files = collectFiles(scope);
  let findings: Finding[] = [];
  for (const f of files) findings = findings.concat(scanFile(f));
  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.measure) {
    runMeasure(args.measure, args.runs);
  } else if (args.scan) {
    runScan(args.scan);
  }
}

main();
