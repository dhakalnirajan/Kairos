#!/usr/bin/env bun
/**
 * code-review/scripts/run.ts
 *
 * Reviews a git diff (or explicit file list) for scope creep, missing
 * tests, and naming inconsistency. Read-only; bash is used only for
 * `git diff`.
 */

import { parseArgs } from "util";
import { readFileSync, existsSync } from "fs";
import { spawnSync } from "child_process";

interface ReviewArgs {
  base: string;
  files?: string[];
  task?: string;
}

interface Comment {
  file: string;
  line: number | null;
  severity: "blocking" | "should-fix" | "nit";
  message: string;
}

function parseCliArgs(): ReviewArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      base: { type: "string", default: "main" },
      files: { type: "string" },
      task: { type: "string" },
    },
  });
  return {
    base: (values.base as string) ?? "main",
    files: values.files ? (values.files as string).split(",").map((f) => f.trim()) : undefined,
    task: values.task as string | undefined,
  };
}

function getChangedFiles(base: string): string[] {
  const result = spawnSync("git", ["diff", "--name-only", base], { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout) {
    // Fall back to working-tree changes if base diff fails (e.g. base not found).
    const fallback = spawnSync("git", ["diff", "--name-only"], { encoding: "utf-8" });
    return fallback.stdout ? fallback.stdout.trim().split("\n").filter(Boolean) : [];
  }
  return result.stdout.trim().split("\n").filter(Boolean);
}

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx)$|test_.*\.py$|_test\.py$/.test(path);
}

function extractKeywords(task: string): string[] {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9_\-/. ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function checkScopeCreep(files: string[], task?: string): Comment[] {
  if (!task) return [];
  const keywords = extractKeywords(task);
  if (keywords.length === 0) return [];
  const comments: Comment[] = [];
  for (const f of files) {
    const lower = f.toLowerCase();
    const hit = keywords.some((k) => lower.includes(k));
    if (!hit) {
      comments.push({
        file: f,
        line: null,
        severity: "nit",
        message: `File does not obviously relate to task "${task}" — confirm this change is in scope.`,
      });
    }
  }
  return comments;
}

function checkMissingTests(files: string[]): Comment[] {
  const sourceFiles = files.filter((f) => !isTestFile(f) && /\.(ts|tsx|js|jsx|py)$/.test(f));
  const testFiles = files.filter(isTestFile);
  if (sourceFiles.length > 0 && testFiles.length === 0) {
    return sourceFiles.map((f) => ({
      file: f,
      line: null,
      severity: "should-fix" as const,
      message: "Source file changed but no test file changes detected in this diff. Confirm coverage exists or add tests.",
    }));
  }
  return [];
}

function checkNamingConsistency(file: string): Comment[] {
  if (!existsSync(file)) return [];
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const camel = (source.match(/\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g) || []).length;
  const snake = (source.match(/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/g) || []).length;
  const comments: Comment[] = [];
  if (camel > 3 && snake > 3) {
    comments.push({
      file,
      line: null,
      severity: "nit",
      message: `File mixes camelCase (${camel} occurrences) and snake_case (${snake} occurrences) identifiers — confirm this is intentional (e.g. wrapping an external API).`,
    });
  }
  return comments;
}

function checkObviousSmells(file: string): Comment[] {
  if (!existsSync(file)) return [];
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const comments: Comment[] = [];
  const lines = source.split("\n");
  lines.forEach((line, i) => {
    if (/console\.(log|debug)\(/.test(line)) {
      comments.push({ file, line: i + 1, severity: "nit", message: "Leftover console.log/debug statement." });
    }
    if (/\bTODO\b|\bFIXME\b/.test(line)) {
      comments.push({ file, line: i + 1, severity: "nit", message: "TODO/FIXME left in changed code — confirm it's tracked or intended to ship." });
    }
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
      comments.push({ file, line: i + 1, severity: "blocking", message: "Empty catch block silently swallows errors." });
    }
  });
  return comments;
}

function main() {
  const args = parseCliArgs();
  const files = args.files ?? getChangedFiles(args.base);

  let comments: Comment[] = [];
  comments = comments.concat(checkScopeCreep(files, args.task));
  comments = comments.concat(checkMissingTests(files));
  for (const f of files) {
    comments = comments.concat(checkNamingConsistency(f));
    comments = comments.concat(checkObviousSmells(f));
  }

  const severityOrder = { blocking: 0, "should-fix": 1, nit: 2 };
  comments.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log(JSON.stringify({ filesReviewed: files.length, comments }, null, 2));
  process.exit(comments.some((c) => c.severity === "blocking") ? 1 : 0);
}

main();
