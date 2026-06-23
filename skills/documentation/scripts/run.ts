#!/usr/bin/env bun
/**
 * documentation/scripts/run.ts
 *
 * Extracts exported symbols and their preceding JSDoc comments from
 * TypeScript source files and compiles a Markdown API reference. Read-only
 * against source except for the compiled doc output itself.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface DocArgs {
  scope: string;
  include: string;
  output?: string;
}

interface ExportEntry {
  signature: string;
  doc: string | null;
}

function parseCliArgs(): DocArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scope: { type: "string" },
      include: { type: "string", default: "**/*.ts" },
      output: { type: "string" },
    },
  });
  if (!values.scope) {
    console.error("Error: --scope is required");
    process.exit(1);
  }
  return {
    scope: values.scope as string,
    include: (values.include as string) ?? "**/*.ts",
    output: values.output as string | undefined,
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
      else if (/\.ts$/.test(entry) && !/\.(test|spec)\.ts$/.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

const EXPORT_RE = /^export\s+(function\s+\w+\s*\([^)]*\)|class\s+\w+|const\s+\w+\s*=|interface\s+\w+|type\s+\w+\s*=)/;

function extractExports(source: string): ExportEntry[] {
  const lines = source.split("\n");
  const entries: ExportEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!EXPORT_RE.test(line)) continue;

    // Find signature, truncated at first '{' or end of line for readability.
    let signature = lines[i].trim();
    const braceIdx = signature.indexOf("{");
    if (braceIdx > -1) signature = signature.slice(0, braceIdx).trim();

    // Look upward for a /** ... */ block ending immediately before this line.
    let doc: string | null = null;
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === "") j--;
    if (j >= 0 && lines[j].trim().endsWith("*/")) {
      let start = j;
      while (start >= 0 && !lines[start].trim().startsWith("/**")) start--;
      if (start >= 0) {
        doc = lines
          .slice(start, j + 1)
          .map((l) => l.trim().replace(/^\/\*\*|\*\/$|^\*\s?/g, ""))
          .filter((l) => l.trim() !== "")
          .join(" ")
          .trim();
      }
    }

    entries.push({ signature, doc: doc || null });
  }
  return entries;
}

function main() {
  const args = parseCliArgs();
  const files = collectFiles(args.scope);

  const lines: string[] = [];
  lines.push(`# API Reference`);
  lines.push("");

  let documented = 0;
  let total = 0;

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const exports = extractExports(source);
    if (exports.length === 0) continue;

    lines.push(`## ${file}`);
    lines.push("");
    for (const e of exports) {
      total++;
      if (e.doc) documented++;
      lines.push(`### \`${e.signature}\``);
      lines.push("");
      lines.push(e.doc ?? "_undocumented_");
      lines.push("");
    }
  }

  lines.push(`---`);
  lines.push(`Documented: ${documented} / ${total} exports`);

  const doc = lines.join("\n");

  if (args.output) {
    writeFileSync(args.output, doc, "utf-8");
    console.log(`Documentation written to ${args.output}`);
  } else {
    console.log(doc);
  }

  console.error(JSON.stringify({ documented, total }));
}

main();
