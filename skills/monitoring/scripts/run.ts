#!/usr/bin/env bun
/**
 * monitoring/scripts/run.ts
 *
 * --audit scans for silent-failure patterns (empty/non-logging catch
 * blocks, unguarded async functions). --scaffold generates health-check
 * and metrics boilerplate. No external monitoring backend integration.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface MonArgs {
  audit: boolean;
  scope?: string;
  scaffold?: "health" | "metrics";
  framework: string;
  output?: string;
  force: boolean;
}

function parseCliArgs(): MonArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      audit: { type: "boolean", default: false },
      scope: { type: "string" },
      scaffold: { type: "string" },
      framework: { type: "string", default: "express" },
      output: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });

  if (!values.audit && !values.scaffold) {
    console.error("Error: one of --audit or --scaffold is required");
    process.exit(1);
  }
  if (values.audit && !values.scope) {
    console.error("Error: --scope is required with --audit");
    process.exit(1);
  }
  if (values.scaffold && !values.output) {
    console.error("Error: --output is required with --scaffold");
    process.exit(1);
  }
  if (values.scaffold && !["health", "metrics"].includes(values.scaffold as string)) {
    console.error("Error: --scaffold must be health|metrics");
    process.exit(1);
  }

  return {
    audit: values.audit as boolean,
    scope: values.scope as string | undefined,
    scaffold: values.scaffold as "health" | "metrics" | undefined,
    framework: (values.framework as string) ?? "express",
    output: values.output as string | undefined,
    force: values.force as boolean,
  };
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

interface Finding {
  file: string;
  line: number;
  severity: "high" | "low";
  issue: string;
}

function auditFile(file: string): Finding[] {
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const findings: Finding[] = [];
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const catchMatch = lines[i].match(/catch\s*\(\s*(\w+)\s*\)\s*\{/);
    if (catchMatch) {
      const varName = catchMatch[1];
      // Brace-match the catch body.
      let depth = 0, started = false, endLine = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") { depth++; started = true; }
          if (ch === "}") depth--;
        }
        if (started && depth === 0) { endLine = j; break; }
      }
      const body = lines.slice(i, endLine + 1).join("\n");
      const logsError = new RegExp(`(console\\.(error|warn)|logger\\.\\w+)\\s*\\([^)]*\\b${varName}\\b`).test(body);
      if (!logsError) {
        findings.push({ file, line: i + 1, severity: "high", issue: `catch (${varName}) block does not appear to log the caught error.` });
      }
    }

    const asyncFnMatch = lines[i].match(/export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=\s*async)/);
    if (asyncFnMatch) {
      const name = asyncFnMatch[1] || asyncFnMatch[2];
      let depth = 0, started = false, endLine = i;
      for (let j = i; j < lines.length; j++) {
        for (const ch of lines[j]) {
          if (ch === "{") { depth++; started = true; }
          if (ch === "}") depth--;
        }
        if (started && depth === 0) { endLine = j; break; }
      }
      const body = lines.slice(i, endLine + 1).join("\n");
      if (!/\btry\s*\{/.test(body)) {
        findings.push({ file, line: i + 1, severity: "low", issue: `async function "${name}" has no try/catch — confirm errors are handled by a global handler if intentional.` });
      }
    }
  }
  return findings;
}

function runAudit(scope: string) {
  const files = collectFiles(scope);
  let findings: Finding[] = [];
  for (const f of files) findings = findings.concat(auditFile(f));
  const order = { high: 0, low: 1 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
}

function renderHealthEndpoint(framework: string): string {
  return `import type { Request, Response } from "express";

const startedAt = Date.now();

export const healthCheck = (req: Request, res: Response): void => {
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
};

// Wire up in your router:
// router.get("/health", healthCheck);
`;
}

function renderMetricsModule(): string {
  return `/**
 * Minimal in-memory metrics module. Replace with a real backend
 * (Prometheus, Datadog, etc.) by implementing the TODO sections below.
 */

const counters = new Map<string, number>();
const timers = new Map<string, number[]>();

export function incrementCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
  // TODO: wire up to your APM/metrics backend (e.g. send to StatsD/Prometheus pushgateway)
}

export function recordTiming(name: string, ms: number): void {
  const list = timers.get(name) ?? [];
  list.push(ms);
  timers.set(name, list);
  // TODO: wire up to your APM/metrics backend
}

export function snapshot() {
  return {
    counters: Object.fromEntries(counters),
    timers: Object.fromEntries([...timers.entries()].map(([k, v]) => [k, { count: v.length, avgMs: v.reduce((a, b) => a + b, 0) / (v.length || 1) }])),
  };
}
`;
}

function runScaffold(args: MonArgs) {
  if (existsSync(args.output!) && !args.force) {
    console.error(JSON.stringify({ error: "output-exists", message: `${args.output} already exists. Use --force to overwrite.` }, null, 2));
    process.exit(1);
  }

  const content = args.scaffold === "health" ? renderHealthEndpoint(args.framework) : renderMetricsModule();
  const dir = dirname(args.output!);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(args.output!, content, "utf-8");

  console.log(JSON.stringify({ output: args.output, kind: args.scaffold }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.audit) runAudit(args.scope!);
  else if (args.scaffold) runScaffold(args);
}

main();
