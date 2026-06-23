#!/usr/bin/env bun
/**
 * refactoring/scripts/run.ts
 *
 * Applies named structural refactoring patterns to a source file:
 * extract-function, rename-symbol, inline-variable, extract-constant.
 * Text-based, not AST-based. Prints a unified diff then writes in place
 * with ask permission.
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync } from "fs";

type Op = "extract-function" | "rename-symbol" | "inline-variable" | "extract-constant";

interface RefactorArgs {
  op: Op;
  file: string;
  range?: [number, number];
  line?: number;
  oldName?: string;
  newName?: string;
  value?: string;
}

const VALID_OPS: Op[] = ["extract-function", "rename-symbol", "inline-variable", "extract-constant"];

function parseCliArgs(): RefactorArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      op: { type: "string" },
      file: { type: "string" },
      range: { type: "string" },
      line: { type: "string" },
      "old-name": { type: "string" },
      "new-name": { type: "string" },
      value: { type: "string" },
    },
  });

  if (!values.op || !VALID_OPS.includes(values.op as Op)) {
    console.error(`Error: --op must be one of: ${VALID_OPS.join(", ")}`);
    process.exit(1);
  }
  if (!values.file) {
    console.error("Error: --file is required");
    process.exit(1);
  }

  const op = values.op as Op;
  let range: [number, number] | undefined;
  if (values.range) {
    const parts = (values.range as string).split(":").map((x) => parseInt(x, 10));
    if (parts.length !== 2 || parts.some(isNaN)) {
      console.error("Error: --range must be start:end (e.g. 12:24)");
      process.exit(1);
    }
    range = [parts[0], parts[1]];
  }

  return {
    op,
    file: values.file as string,
    range,
    line: values.line ? parseInt(values.line as string, 10) : undefined,
    oldName: values["old-name"] as string | undefined,
    newName: values["new-name"] as string | undefined,
    value: values.value as string | undefined,
  };
}

function unifiedDiff(original: string[], modified: string[], filename: string): string {
  const diff: string[] = [`--- ${filename}`, `+++ ${filename} (refactored)`];
  const maxLen = Math.max(original.length, modified.length);
  let i = 0;
  while (i < maxLen) {
    const o = original[i] ?? null;
    const m = modified[i] ?? null;
    if (o !== m) {
      if (o !== null) diff.push(`-${o}`);
      if (m !== null) diff.push(`+${m}`);
    } else {
      diff.push(` ${o}`);
    }
    i++;
  }
  return diff.join("\n");
}

function extractFunction(lines: string[], range: [number, number], newName: string): string[] {
  const [start, end] = [range[0] - 1, range[1] - 1]; // 0-indexed
  const extracted = lines.slice(start, end + 1);
  const indent = extracted[0].match(/^(\s*)/)?.[1] ?? "";
  const fnLines = [
    `${indent}function ${newName}() {`,
    ...extracted.map((l) => `  ${l}`),
    `${indent}}`,
    "",
  ];
  const modified = [
    ...lines.slice(0, start),
    ...fnLines,
    `${indent}${newName}();`,
    ...lines.slice(end + 1),
  ];
  return modified;
}

function renameSymbol(lines: string[], oldName: string, newName: string): string[] {
  const re = new RegExp(`\\b${escapeRe(oldName)}\\b`, "g");
  return lines.map((l) => l.replace(re, newName));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inlineVariable(lines: string[], range: [number, number], varName: string): string[] {
  const [start, end] = [range[0] - 1, range[1] - 1];
  const scope = lines.slice(start, end + 1);
  const assignRe = new RegExp(`^\\s*(?:const|let|var)\\s+${escapeRe(varName)}\\s*=\\s*(.+?);?\\s*$`);
  const assignments = scope.map((l, i) => ({ i, m: l.match(assignRe) })).filter((x) => x.m);
  if (assignments.length !== 1) {
    console.error(
      JSON.stringify({ error: "inline-variable", message: `Expected exactly 1 assignment of "${varName}" in range, found ${assignments.length}. Inline is only safe for single-assignment variables.` }, null, 2)
    );
    process.exit(1);
  }
  const { i: assignIdx, m } = assignments[0];
  const rhs = m![1].trim();
  const useRe = new RegExp(`\\b${escapeRe(varName)}\\b`, "g");
  const modified = scope
    .filter((_, idx) => idx !== assignIdx)
    .map((l) => l.replace(useRe, rhs));
  return [...lines.slice(0, start), ...modified, ...lines.slice(end + 1)];
}

function extractConstant(lines: string[], lineNo: number, literalValue: string, constName: string): string[] {
  const idx = lineNo - 1;
  const target = lines[idx];
  const quotedRe = new RegExp(`(['"\`])${escapeRe(literalValue)}\\1`, "g");
  const numRe = new RegExp(`\\b${escapeRe(literalValue)}\\b`, "g");
  const isNumeric = /^-?\d+(\.\d+)?$/.test(literalValue);
  const valueExpr = isNumeric ? literalValue : `"${literalValue}"`;
  const constDecl = `const ${constName} = ${valueExpr};`;

  const modified = lines.map((l, i) => {
    if (i === idx) {
      return l.replace(isNumeric ? numRe : quotedRe, constName);
    }
    return l.replace(isNumeric ? numRe : quotedRe, constName);
  });

  // Insert const at line 0 or just before the target line if it's not already there.
  const insertAt = Math.max(0, idx);
  modified.splice(insertAt, 0, constDecl);
  return modified;
}

function main() {
  const args = parseCliArgs();
  const source = readFileSync(args.file, "utf-8");
  const lines = source.split("\n");

  let modified: string[];
  switch (args.op) {
    case "extract-function":
      if (!args.range || !args.newName) {
        console.error("Error: extract-function requires --range and --new-name");
        process.exit(1);
      }
      modified = extractFunction(lines, args.range, args.newName);
      break;
    case "rename-symbol":
      if (!args.oldName || !args.newName) {
        console.error("Error: rename-symbol requires --old-name and --new-name");
        process.exit(1);
      }
      modified = renameSymbol(lines, args.oldName, args.newName);
      break;
    case "inline-variable":
      if (!args.range || !args.oldName) {
        console.error("Error: inline-variable requires --range and --old-name");
        process.exit(1);
      }
      modified = inlineVariable(lines, args.range, args.oldName);
      break;
    case "extract-constant":
      if (!args.line || !args.newName || !(args.value || args.oldName)) {
        console.error("Error: extract-constant requires --line, --new-name, and --value (or --old-name)");
        process.exit(1);
      }
      modified = extractConstant(lines, args.line, (args.value ?? args.oldName)!, args.newName);
      break;
  }

  const diff = unifiedDiff(lines, modified, args.file);
  const linesChanged = modified.filter((l, i) => l !== lines[i]).length;

  process.stdout.write(diff + "\n\n");
  writeFileSync(args.file, modified.join("\n"), "utf-8");
  console.log(JSON.stringify({ op: args.op, file: args.file, linesChanged }, null, 2));
}

main();
