#!/usr/bin/env bun
/**
 * testing/scripts/run.ts
 *
 * Runs the project's existing test suite and normalizes the result across
 * frameworks into one JSON shape. Does not write or fix tests.
 */

import { parseArgs } from "util";
import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";

type Framework = "jest" | "vitest" | "bun-test" | "pytest";

interface TestingArgs {
  filter?: string;
  framework?: Framework;
  coverage: boolean;
}

interface NormalizedResult {
  framework: Framework;
  passed: number;
  failed: number;
  skipped: number;
  failures: { name: string; message: string }[];
  coverage: { lines: number; branches: number } | null;
}

function parseCliArgs(): TestingArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      filter: { type: "string" },
      framework: { type: "string" },
      coverage: { type: "boolean", default: false },
    },
  });
  return {
    filter: values.filter as string | undefined,
    framework: values.framework as Framework | undefined,
    coverage: values.coverage as boolean,
  };
}

function detectFramework(): Framework {
  if (existsSync("bun.lockb") || existsSync("bunfig.toml")) return "bun-test";
  if (existsSync("package.json")) {
    try {
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) return "vitest";
      if (deps.jest) return "jest";
    } catch {
      /* fall through */
    }
  }
  if (existsSync("pytest.ini") || existsSync("pyproject.toml") || existsSync("setup.py")) return "pytest";
  return "vitest";
}

function buildCommand(framework: Framework, args: TestingArgs): string[] {
  switch (framework) {
    case "bun-test":
      return ["bun", "test", ...(args.filter ? ["-t", args.filter] : []), ...(args.coverage ? ["--coverage"] : [])];
    case "vitest":
      return ["npx", "vitest", "run", ...(args.filter ? ["-t", args.filter] : []), ...(args.coverage ? ["--coverage"] : [])];
    case "jest":
      return ["npx", "jest", ...(args.filter ? ["-t", args.filter] : []), ...(args.coverage ? ["--coverage"] : [])];
    case "pytest":
      return ["pytest", "-q", ...(args.filter ? ["-k", args.filter] : []), ...(args.coverage ? ["--cov"] : [])];
  }
}

function parseOutput(framework: Framework, stdout: string, stderr: string): NormalizedResult {
  const text = `${stdout}\n${stderr}`;
  const failures: { name: string; message: string }[] = [];
  let passed = 0, failed = 0, skipped = 0;
  let coverage: NormalizedResult["coverage"] = null;

  if (framework === "pytest") {
    const summary = text.match(/(\d+) passed/);
    const failSummary = text.match(/(\d+) failed/);
    const skipSummary = text.match(/(\d+) skipped/);
    if (summary) passed = parseInt(summary[1], 10);
    if (failSummary) failed = parseInt(failSummary[1], 10);
    if (skipSummary) skipped = parseInt(skipSummary[1], 10);
    const failBlocks = text.matchAll(/FAILED\s+([^\s]+)\s*-?\s*(.*)/g);
    for (const m of failBlocks) failures.push({ name: m[1], message: m[2] || "no message captured" });
    const covMatch = text.match(/TOTAL\s+\d+\s+\d+\s+(\d+)%/);
    if (covMatch) coverage = { lines: parseInt(covMatch[1], 10), branches: -1 };
  } else {
    // Jest/Vitest/bun:test share a roughly similar summary shape.
    const passMatch = text.match(/(\d+) passed/i);
    const failMatch = text.match(/(\d+) failed/i);
    const skipMatch = text.match(/(\d+) skipped/i);
    if (passMatch) passed = parseInt(passMatch[1], 10);
    if (failMatch) failed = parseInt(failMatch[1], 10);
    if (skipMatch) skipped = parseInt(skipMatch[1], 10);
    const failBlocks = text.matchAll(/(?:✗|✕|FAIL)\s+(.+)/g);
    for (const m of failBlocks) failures.push({ name: m[1].trim(), message: "see full output for stack trace" });
    const covMatch = text.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
    if (covMatch) coverage = { lines: parseFloat(covMatch[1]), branches: parseFloat(covMatch[2]) };
  }

  return { framework, passed, failed, skipped, failures, coverage };
}

function main() {
  const args = parseCliArgs();
  const framework = args.framework ?? detectFramework();
  const cmd = buildCommand(framework, args);

  const result = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf-8" });
  const normalized = parseOutput(framework, result.stdout ?? "", result.stderr ?? "");

  console.log(JSON.stringify(normalized, null, 2));
  process.exit(normalized.failed > 0 ? 1 : 0);
}

main();
