---
name: "tdd"
version: "1.0.0"
description: "Drives red-green-refactor: writes a failing test for a described behavior, then waits for implementation before allowing the next test"
author: "harness-core"
category: "automation"
tools:
  - read_file
  - write_file
  - bash
permissions:
  - allow: [read_file]
  - ask: [write_file, bash]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`tdd` enforces the test-first discipline mechanically rather than by
convention. Given a description of a single behavior, it generates a test
file (or a test case appended to an existing file), runs it to confirm it
currently fails for the right reason (not a syntax error), and reports a
clear "red" status. It refuses to generate a second test for the same
target until the prior one is reported "green."

This is deliberately narrower than `testing`: `testing` runs and reports on
an existing suite; `tdd` is about the authoring loop for one new test at a
time, including the discipline of confirming the test fails first.

## Behavior Patterns

- Accepts one behavior description per invocation — multi-behavior requests
  are rejected with a message asking for them to be split.
- Detects the test framework in use (Jest, Vitest, bun:test, pytest) by
  inspecting `package.json` / lockfiles rather than assuming one.
- After writing the test, immediately executes it via `bash` (ask
  permission) and reports whether it failed for an assertion reason (good —
  this is "red") or an error reason like a missing import (bad — the test
  itself is broken and needs fixing before implementation starts).
- Tracks state per target function/file in `.tdd-state.json` so repeated
  invocations know whether the current cycle is red or green.
- Never writes implementation code — that is out of scope; `tdd` only
  writes and runs tests.

## When to Use

- Starting any new function, endpoint, or component where behavior can be
  described as a concrete input/output or state-change assertion.
- Fixing a bug: write the regression test first via `tdd`, confirm it
  reproduces the bug (red), then implement the fix separately.
- Not useful for exploratory spikes or prototypes where requirements are
  still being discovered — use those informally first, then formalize with
  `tdd` once behavior is decided.

## Example Invocations

```
/skill run tdd --behavior "parseDate returns null for an invalid date string" --target src/date.ts
/skill run tdd --behavior "POST /login returns 401 for wrong password" --target src/routes/login.ts --framework vitest
/skill run tdd --status --target src/date.ts
```

## Expected Inputs

- `--behavior` (string, required unless `--status`): one concrete,
  testable behavior description.
- `--target` (path, required): the source file the behavior belongs to.
- `--framework` (jest|vitest|bun-test|pytest, optional): override
  auto-detection.
- `--status` (flag, optional): report red/green state for `--target`
  without writing a new test.

## Expected Outputs

JSON to stdout: `{ "target": string, "testFile": string, "status": "red"|"green"|"broken", "reason": string }`.
A `status: "broken"` result means the test itself failed to run (syntax or
import error) and must be fixed before the cycle can proceed. The written
test file path is always included so it can be reviewed directly.

## Side Effects and Warnings

- Writes a new test file or appends to an existing one — always requires
  `ask` confirmation before the write.
- Runs `bash` to execute the test runner — also requires `ask`
  confirmation; this executes real code in the project's test environment.
- Maintains `.tdd-state.json` at the project root; safe to delete, it will
  be regenerated, but doing so loses cycle history.
- Will refuse a second `--behavior` for the same `--target` while that
  target's last known status is `red` or `broken` — finish or explicitly
  abandon the current cycle first.
