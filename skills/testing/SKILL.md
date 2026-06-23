---
name: "testing"
version: "1.0.0"
description: "Runs the project's existing test suite, parses results across frameworks, and reports a normalized pass/fail/coverage summary"
author: "harness-core"
category: "testing"
tools:
  - read_file
  - bash
permissions:
  - allow: [read_file]
  - ask: [bash]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`testing` executes the test suite already present in a project — it does
not write tests (that's `tdd`) and does not fix failures (that's
`debug` / `code-generation`). Its job is to run things and produce one
normalized report regardless of whether the underlying framework is Jest,
Vitest, bun:test, or pytest, so the rest of the harness doesn't need
framework-specific parsing logic scattered across every other skill.

## Behavior Patterns

- Auto-detects the test framework the same way `tdd` does, by inspecting
  lockfiles and `package.json`/`pyproject.toml`, unless `--framework` is
  given explicitly.
- Runs the full suite by default; `--filter` narrows to matching test
  names or file paths, passed through to the underlying runner's native
  filter flag.
- Normalizes pass/fail/skip counts and per-test failure messages into one
  JSON shape regardless of source framework.
- If `--coverage` is passed, requests coverage output from the runner and
  reports overall line/branch percentages if the runner supports it;
  reports `coverage: null` rather than failing if it doesn't.
- Exits non-zero whenever any test fails, mirroring the underlying runner's
  exit code, so it composes correctly in CI scripts.

## When to Use

- After any code change, before considering a task complete.
- As the verification step at the end of a `plan` checklist.
- In CI, as the canonical "did the suite pass" check.
- Not for writing new tests — use `tdd` for that.

## Example Invocations

```
/skill run testing
/skill run testing --filter "user.test.ts"
/skill run testing --coverage
/skill run testing --framework pytest --filter "test_login"
```

## Expected Inputs

- `--filter` (string, optional): substring/pattern passed to the runner's
  native filter mechanism.
- `--framework` (jest|vitest|bun-test|pytest, optional): override
  auto-detection.
- `--coverage` (flag, optional): request coverage reporting.

## Expected Outputs

JSON: `{ "framework": string, "passed": number, "failed": number, "skipped": number, "failures": [{ "name": string, "message": string }], "coverage": { "lines": number, "branches": number } | null }`.

## Side Effects and Warnings

- Executes the real test suite via `bash`, requiring `ask` permission —
  this runs project code, including any side effects individual tests have.
- Exit code mirrors test pass/fail, not script success — a non-zero exit
  with valid JSON output means tests failed, not that `testing` itself
  errored. Check the JSON body, not just the exit code, to distinguish a
  tooling failure from a test failure.
- Coverage collection can significantly slow down large suites; omit
  `--coverage` for quick iteration loops.
