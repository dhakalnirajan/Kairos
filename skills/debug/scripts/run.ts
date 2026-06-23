#!/usr/bin/env bun
/**
 * debug/scripts/run.ts
 *
 * Reproduces a bug if a repro command is given, parses stack traces to
 * find candidate root-cause locations, and emits a report. Read-only
 * against source files.
 */

import { parseArgs } from "util";
import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

interface DebugArgs {
  symptom: string;
  repro?: string;
  trace?: string;
  target?: string;
}

interface StackFrame {
  file: string;
  line: number;
}

function parseCliArgs(): DebugArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      symptom: { type: "string" },
      repro: { type: "string" },
      trace: { type: "string" },
      target: { type: "string" },
    },
  });

  if (!values.symptom) {
    console.error("Error: --symptom is required");
    process.exit(1);
  }

  return {
    symptom: values.symptom as string,
    repro: values.repro as string | undefined,
    trace: values.trace as string | undefined,
    target: values.target as string | undefined,
  };
}

function runRepro(cmd: string): { output: string; failed: boolean } {
  const result = spawnSync(cmd, { shell: true, encoding: "utf-8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { output, failed: (result.status ?? 0) !== 0 };
}

/** Parses common JS/TS and Python stack trace formats into file:line frames. */
function parseStackFrames(text: string): StackFrame[] {
  const frames: StackFrame[] = [];
  // JS/TS: "at functionName (path/to/file.ts:12:5)" or "at path/to/file.ts:12:5"
  const jsRe = /at\s+(?:.*\()?([^\s():]+\.(?:ts|js|tsx|jsx)):(\d+):\d+\)?/g;
  let m: RegExpExecArray | null;
  while ((m = jsRe.exec(text))) {
    frames.push({ file: m[1], line: parseInt(m[2], 10) });
  }
  // Python: 'File "path/to/file.py", line 12, in func'
  const pyRe = /File "([^"]+\.py)", line (\d+)/g;
  while ((m = pyRe.exec(text))) {
    frames.push({ file: m[1], line: parseInt(m[2], 10) });
  }
  return frames;
}

function readContext(file: string, line: number, radius = 3): string | null {
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, "utf-8").split("\n");
  const start = Math.max(0, line - radius - 1);
  const end = Math.min(lines.length, line + radius);
  return lines
    .slice(start, end)
    .map((l, i) => `${start + i + 1}${start + i + 1 === line ? " >" : "  "} ${l}`)
    .join("\n");
}

function staticSearch(symptom: string, target?: string): string[] {
  // Pull a plausible identifier out of the symptom (quoted string, or last word-like token).
  const quoted = symptom.match(/['"]([^'"]+)['"]/);
  const needle = quoted ? quoted[1] : symptom.split(/\s+/).filter((w) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(w)).pop();
  if (!needle) return [];
  const args = ["-rn", "--include=*.ts", "--include=*.js", "--include=*.py", needle, target ?? "."];
  const result = spawnSync("grep", args, { encoding: "utf-8" });
  if (!result.stdout) return [];
  return result.stdout.trim().split("\n").slice(0, 10);
}

function main() {
  const args = parseCliArgs();
  let rawTrace = "";
  let reproduced = false;
  let reproFailed = false;

  if (args.repro) {
    const { output, failed } = runRepro(args.repro);
    rawTrace = output;
    reproduced = true;
    reproFailed = failed;
  } else if (args.trace && existsSync(args.trace)) {
    rawTrace = readFileSync(args.trace, "utf-8");
    reproduced = true;
  }

  const frames = rawTrace ? parseStackFrames(rawTrace) : [];
  const evidence: string[] = [];
  let rootCause: string | null = null;
  let confidence: "high" | "low" | "none" = "none";

  if (frames.length > 0) {
    for (const f of frames.slice(0, 5)) {
      const ctx = readContext(f.file, f.line);
      if (ctx) {
        evidence.push(`${f.file}:${f.line}\n${ctx}`);
      } else {
        evidence.push(`${f.file}:${f.line} (file not found at this path from current working directory)`);
      }
    }
    if (evidence.some((e) => !e.includes("file not found"))) {
      confidence = "high";
      rootCause = `Failure traced to ${frames[0].file}:${frames[0].line}. See evidence for surrounding code.`;
    } else {
      confidence = "low";
      rootCause = "Stack trace parsed but referenced files could not be located from the current directory.";
    }
  } else {
    const matches = staticSearch(args.symptom, args.target);
    if (matches.length > 0) {
      evidence.push(...matches);
      confidence = "low";
      rootCause = "No reproduction available; these are static-analysis candidates only, not a confirmed cause.";
    }
  }

  if (args.repro && !reproFailed) {
    reproduced = false; // repro command succeeded — bug did not manifest
    confidence = "none";
    rootCause = null;
    evidence.length = 0;
    evidence.push(`Repro command "${args.repro}" exited 0 — symptom did not reproduce.`);
  }

  const report = {
    reproduced,
    confidence,
    rootCause,
    evidence,
    suggestedNextSkill: rootCause ? "code-generation or refactoring, scoped to the evidence above" : "debug again with --repro or --trace for stronger evidence",
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
