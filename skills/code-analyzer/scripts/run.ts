#!/usr/bin/env bun
/**
 * code-analyzer/scripts/run.ts
 *
 * Builds a static import graph and reports circular dependencies, unused
 * exports (within scope), and fan-in/fan-out hotspots. Read-only.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, dirname, resolve, normalize } from "path";

type Check = "cycles" | "unused-exports" | "hotspots" | "all";

interface AnalyzerArgs {
  scope: string;
  check: Check;
  top?: number;
}

function parseCliArgs(): AnalyzerArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scope: { type: "string" },
      check: { type: "string", default: "all" },
      top: { type: "string" },
    },
  });
  if (!values.scope) {
    console.error("Error: --scope is required");
    process.exit(1);
  }
  const check = (values.check as Check) ?? "all";
  if (!["cycles", "unused-exports", "hotspots", "all"].includes(check)) {
    console.error("Error: --check must be cycles|unused-exports|hotspots|all");
    process.exit(1);
  }
  return { scope: values.scope as string, check, top: values.top ? parseInt(values.top as string, 10) : undefined };
}

function collectFiles(scope: string): string[] {
  const acc: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if ([".git", "node_modules", "dist", "build"].includes(entry)) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

function resolveImport(fromFile: string, importPath: string, allFiles: Set<string>): string | null {
  if (!importPath.startsWith(".")) return null; // external package, not followed
  const base = resolve(dirname(fromFile), importPath);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, join(base, "index.ts"), join(base, "index.js")];
  for (const c of candidates) {
    const norm = normalize(c);
    if (allFiles.has(norm)) return norm;
  }
  return null;
}

const IMPORT_RE = /(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?|require\s*\(\s*)['"]([^'"]+)['"]/g;
const EXPORT_NAME_RE = /export\s+(?:function|class|const|interface|type)\s+(\w+)/g;
const IMPORTED_NAME_RE = /import\s+\{([^}]+)\}\s+from/g;

function buildGraph(files: string[]) {
  const allFiles = new Set(files.map((f) => normalize(resolve(f))));
  const graph = new Map<string, string[]>();
  const exportsByFile = new Map<string, Set<string>>();
  const importedNamesGlobal = new Set<string>();

  for (const file of files) {
    const normFile = normalize(resolve(file));
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const deps: string[] = [];
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(source))) {
      const resolved = resolveImport(file, m[1], allFiles);
      if (resolved) deps.push(resolved);
    }
    graph.set(normFile, deps);

    const exp = new Set<string>();
    EXPORT_NAME_RE.lastIndex = 0;
    while ((m = EXPORT_NAME_RE.exec(source))) exp.add(m[1]);
    exportsByFile.set(normFile, exp);

    IMPORTED_NAME_RE.lastIndex = 0;
    while ((m = IMPORTED_NAME_RE.exec(source))) {
      for (const name of m[1].split(",")) {
        importedNamesGlobal.add(name.trim().split(" as ")[0].trim());
      }
    }
  }

  return { graph, exportsByFile, importedNamesGlobal, allFiles };
}

function findCycles(graph: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(node: string) {
    visited.add(node);
    stack.push(node);
    onStack.add(node);

    for (const dep of graph.get(node) ?? []) {
      if (onStack.has(dep)) {
        const cycleStart = stack.indexOf(dep);
        const cycle = stack.slice(cycleStart).concat(dep);
        // Avoid duplicate cycles (same set, different rotation/start point).
        const key = [...new Set(cycle)].sort().join("|");
        if (!cycles.some((c) => [...new Set(c)].sort().join("|") === key)) {
          cycles.push(cycle);
        }
      } else if (!visited.has(dep)) {
        dfs(dep);
      }
    }

    stack.pop();
    onStack.delete(node);
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node);
  }
  return cycles;
}

function findUnusedExports(exportsByFile: Map<string, Set<string>>, importedNamesGlobal: Set<string>) {
  const unused: { file: string; export: string }[] = [];
  for (const [file, names] of exportsByFile.entries()) {
    for (const name of names) {
      if (!importedNamesGlobal.has(name)) {
        unused.push({ file, export: name });
      }
    }
  }
  return unused;
}

function computeHotspots(graph: Map<string, string[]>, top?: number) {
  const fanOut = new Map<string, number>();
  const fanIn = new Map<string, number>();
  for (const [file, deps] of graph.entries()) {
    fanOut.set(file, deps.length);
    for (const d of deps) fanIn.set(d, (fanIn.get(d) ?? 0) + 1);
  }
  const files = new Set([...graph.keys()]);
  let results = [...files].map((f) => ({ file: f, fanIn: fanIn.get(f) ?? 0, fanOut: fanOut.get(f) ?? 0 }));
  results.sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut));
  if (top) results = results.slice(0, top);
  return results;
}

function main() {
  const args = parseCliArgs();
  const files = collectFiles(args.scope);
  const { graph, exportsByFile, importedNamesGlobal } = buildGraph(files);

  const report: any = { filesAnalyzed: files.length, cycles: [], unusedExports: [], hotspots: [] };

  if (args.check === "cycles" || args.check === "all") {
    report.cycles = findCycles(graph);
  }
  if (args.check === "unused-exports" || args.check === "all") {
    report.unusedExports = findUnusedExports(exportsByFile, importedNamesGlobal);
  }
  if (args.check === "hotspots" || args.check === "all") {
    report.hotspots = computeHotspots(graph, args.top);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
