#!/usr/bin/env bun
/**
 * tdd/scripts/run.ts
 *
 * Writes one failing test for one described behavior, runs it, and
 * reports red/green/broken status. Tracks per-target cycle state in
 * .tdd-state.json so a second test isn't started before the first is green.
 */

import { parseArgs } from "util";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join, basename, extname } from "path";

type Framework = "jest" | "vitest" | "bun-test" | "pytest";
type Status = "red" | "green" | "broken";

interface TddArgs {
  behavior?: string;
  target?: string;
  framework?: Framework;
  status: boolean;
}

const STATE_FILE = ".tdd-state.json";

function parseCliArgs(): TddArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      behavior: { type: "string" },
      target: { type: "string" },
      framework: { type: "string" },
      status: { type: "boolean", default: false },
    },
  });

  if (!values.status && !values.behavior) {
    console.error("Error: --behavior is required unless --status is given");
    process.exit(1);
  }
  if (!values.target) {
    console.error("Error: --target is required");
    process.exit(1);
  }

  return {
    behavior: values.behavior as string | undefined,
    target: values.target as string,
    framework: values.framework as Framework | undefined,
    status: values.status as boolean,
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
  if (existsSync("pytest.ini") || existsSync("pyproject.toml")) return "pytest";
  return "vitest";
}

function loadState(): Record<string, { status: Status; testFile: string }> {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state: Record<string, { status: Status; testFile: string }>) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function testFileFor(target: string, framework: Framework): string {
  const dir = dirname(target);
  const base = basename(target, extname(target));
  if (framework === "pytest") return join(dir, `test_${base}.py`);
  return join(dir, `${base}.test.ts`);
}

function renderTestStub(behavior: string, target: string, framework: Framework): string {
  const importPath = `./${basename(target, extname(target))}`;
  if (framework === "pytest") {
    return `def test_${behavior.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60)}():\n    """${behavior}"""\n    assert False, "not yet implemented"\n`;
  }
  const fn = framework === "bun-test" ? `import { test, expect } from "bun:test";` : `import { test, expect } from "${framework}";`;
  return `${fn}\nimport "${importPath}";\n\ntest(${JSON.stringify(behavior)}, () => {\n  expect(false).toBe(true); // placeholder until implementation lands\n});\n`;
}

function runTest(testFile: string, framework: Framework): { status: Status; reason: string } {
  const cmd =
    framework === "pytest" ? ["pytest", testFile, "-q"] :
    framework === "bun-test" ? ["bun", "test", testFile] :
    framework === "jest" ? ["npx", "jest", testFile] :
    ["npx", "vitest", "run", testFile];

  const result = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf-8" });
  const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

  if (result.error) {
    return { status: "broken", reason: `Could not execute test runner: ${result.error.message}` };
  }
  if (/SyntaxError|Cannot find module|ModuleNotFoundError|ImportError/i.test(out)) {
    return { status: "broken", reason: "Test failed to load (syntax or import error), not a clean assertion failure." };
  }
  if (result.status === 0) {
    return { status: "green", reason: "Test passed." };
  }
  return { status: "red", reason: "Test ran and failed on assertion, as expected for a new behavior." };
}

function main() {
  const args = parseCliArgs();
  const framework = args.framework ?? detectFramework();
  const state = loadState();

  if (args.status) {
    const entry = state[args.target!];
    console.log(JSON.stringify(entry ?? { target: args.target, status: "unknown", reason: "No cycle recorded for this target." }, null, 2));
    return;
  }

  const target = args.target!;
  const existing = state[target];
  if (existing && (existing.status === "red" || existing.status === "broken")) {
    console.error(
      JSON.stringify(
        {
          error: "cycle-in-progress",
          message: `Target "${target}" has an unresolved ${existing.status} test (${existing.testFile}). Resolve it before starting a new behavior.`,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  const testFile = testFileFor(target, framework);
  const stub = renderTestStub(args.behavior!, target, framework);

  if (existsSync(testFile)) {
    appendFileSync(testFile, `\n${stub}`, "utf-8");
  } else {
    writeFileSync(testFile, stub, "utf-8");
  }

  const { status, reason } = runTest(testFile, framework);
  state[target] = { status, testFile };
  saveState(state);

  console.log(JSON.stringify({ target, testFile, status, reason }, null, 2));
  if (status === "broken") process.exit(1);
}

main();
