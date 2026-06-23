#!/usr/bin/env bun
/**
 * simplify/scripts/run.ts
 *
 * Heuristic complexity scanner: cyclomatic complexity, nesting depth,
 * function length, parameter count. Syntax-heuristic based (brace/keyword
 * counting), not a full parser. Read-only.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

interface SimplifyArgs {
  scope: string;
  thresholdComplexity: number;
  thresholdLength: number;
  thresholdDepth: number;
  thresholdParams: number;
  top?: number;
}

interface Finding {
  file: string;
  function: string;
  line: number;
  complexity: number;
  depth: number;
  length: number;
  params: number;
  reasons: string[];
}

function parseCliArgs(): SimplifyArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scope: { type: "string" },
      "threshold-complexity": { type: "string", default: "10" },
      "threshold-length": { type: "string", default: "50" },
      "threshold-depth": { type: "string", default: "4" },
      "threshold-params": { type: "string", default: "5" },
      top: { type: "string" },
    },
  });

  if (!values.scope) {
    console.error("Error: --scope is required");
    process.exit(1);
  }

  return {
    scope: values.scope as string,
    thresholdComplexity: parseInt(values["threshold-complexity"] as string, 10),
    thresholdLength: parseInt(values["threshold-length"] as string, 10),
    thresholdDepth: parseInt(values["threshold-depth"] as string, 10),
    thresholdParams: parseInt(values["threshold-params"] as string, 10),
    top: values.top ? parseInt(values.top as string, 10) : undefined,
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

/** Finds top-level function/method declarations with a brace-matched body. */
function extractFunctions(source: string): { name: string; line: number; body: string; params: number }[] {
  const results: { name: string; line: number; body: string; params: number }[] = [];
  const fnRe = /(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*\{)\s*\(([^)]*)\)\s*(?::\s*[^\{]+)?\{/g;
  // Simpler, more robust pass: match "function name(...)" and "name(...) {" patterns line by line with brace counting.
  const lines = source.split("\n");
  const simpleRe = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)|(?:^|\s)(\w+)\s*\(([^)]*)\)\s*\{$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(simpleRe);
    if (!m) continue;
    const name = m[1] || m[3];
    const paramsStr = m[2] ?? m[4] ?? "";
    if (!name || ["if", "for", "while", "switch", "catch"].includes(name)) continue;
    if (!lines[i].includes("{")) continue;

    // Brace-match from this line to find function body extent.
    let depth = 0;
    let started = false;
    let endLine = i;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === "{") { depth++; started = true; }
        if (ch === "}") depth--;
      }
      if (started && depth === 0) { endLine = j; break; }
    }
    const body = lines.slice(i, endLine + 1).join("\n");
    const params = paramsStr.trim() === "" ? 0 : paramsStr.split(",").filter((p) => p.trim()).length;
    results.push({ name, line: i + 1, body, params });
  }
  return results;
}

function measureComplexity(body: string): number {
  const branchKeywords = /\b(if|else if|for|while|case|catch|\?\s|&&|\|\|)\b/g;
  const matches = body.match(branchKeywords);
  return 1 + (matches ? matches.length : 0);
}

function measureMaxDepth(body: string): number {
  let depth = 0, max = 0;
  for (const ch of body) {
    if (ch === "{") { depth++; max = Math.max(max, depth); }
    if (ch === "}") depth--;
  }
  return max;
}

function analyzeFile(file: string, args: SimplifyArgs): Finding[] {
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const fns = extractFunctions(source);
  const findings: Finding[] = [];

  for (const fn of fns) {
    const complexity = measureComplexity(fn.body);
    const depth = measureMaxDepth(fn.body);
    const length = fn.body.split("\n").length;
    const reasons: string[] = [];

    if (complexity > args.thresholdComplexity) reasons.push(`cyclomatic complexity ${complexity} > ${args.thresholdComplexity}`);
    if (depth > args.thresholdDepth) reasons.push(`nesting depth ${depth} > ${args.thresholdDepth}`);
    if (length > args.thresholdLength) reasons.push(`length ${length} lines > ${args.thresholdLength}`);
    if (fn.params > args.thresholdParams) reasons.push(`${fn.params} parameters > ${args.thresholdParams}`);

    if (reasons.length > 0) {
      findings.push({ file, function: fn.name, line: fn.line, complexity, depth, length, params: fn.params, reasons });
    }
  }
  return findings;
}

function severityScore(f: Finding, args: SimplifyArgs): number {
  return (
    Math.max(0, f.complexity - args.thresholdComplexity) +
    Math.max(0, f.depth - args.thresholdDepth) +
    Math.max(0, f.length - args.thresholdLength) / 10 +
    Math.max(0, f.params - args.thresholdParams)
  );
}

function main() {
  const args = parseCliArgs();
  const files = collectFiles(args.scope);
  let allFindings: Finding[] = [];

  for (const file of files) {
    allFindings = allFindings.concat(analyzeFile(file, args));
  }

  allFindings.sort((a, b) => severityScore(b, args) - severityScore(a, args));
  if (args.top) allFindings = allFindings.slice(0, args.top);

  console.log(JSON.stringify({ scanned: files.length, flagged: allFindings }, null, 2));
}

main();
