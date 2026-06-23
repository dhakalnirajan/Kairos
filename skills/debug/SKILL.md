---
name: "debug"
version: "1.0.0"
description: "Reproduces a reported bug, isolates the failing code path, and reports root cause with evidence — does not change source code"
author: "harness-core"
category: "analysis"
tools:
  - read_file
  - grep
  - bash
permissions:
  - allow: [read_file, grep]
  - ask: [bash]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Note on naming

This skill merges what were previously two separate entries, `debug` and
`debugging`, which described the same workflow under different names. There
is one skill here, named `debug`.

## Purpose

`debug` takes a symptom description (an error message, a stack trace, a
"this should happen but that happens instead" report) and works backward to
a root cause. It runs the reproduction if one is provided, inspects the
relevant stack frames and surrounding code, and produces a root-cause report
with the evidence trail — not a fix. Fixing is `code-generation` or
`refactoring`'s job, with `debug`'s report as input.

## Behavior Patterns

- Always tries to reproduce before theorizing. If `--repro` is given (a
  command to run), it runs it first and captures actual output before
  reading any code.
- Walks the stack trace top-down, reading each referenced file at the
  referenced line plus surrounding context, rather than guessing from the
  error message alone.
- Distinguishes three outcomes explicitly: reproduced-with-clear-cause,
  reproduced-but-cause-unclear, and not-reproduced. It does not present a
  guess as a confirmed cause.
- When no `--repro` command is given, falls back to static analysis: greps
  for the error string or function name across the codebase and reports
  candidate locations ranked by relevance, clearly labeled as unconfirmed.
- Never modifies source files. Output is a report only.

## When to Use

- Any bug report that includes a stack trace, error message, or reliable
  reproduction steps.
- Before reaching for `refactoring` or `code-generation` to fix something —
  use `debug` first so the fix targets the actual cause, not the symptom.
- Not useful for vague reports like "it feels slow" with no reproduction —
  use `performance` for that instead.

## Example Invocations

```
/skill run debug --symptom "TypeError: cannot read property 'id' of undefined" --repro "bun test src/user.test.ts"
/skill run debug --symptom "Login returns 500 intermittently" --trace ./crash.log
/skill run debug --symptom "parseDate returns wrong year for 2-digit input" --target src/date.ts
```

## Expected Inputs

- `--symptom` (string, required): description of the observed problem.
- `--repro` (string, optional): a shell command that reproduces the issue.
- `--trace` (path, optional): path to a file containing a stack trace or
  log output to parse instead of running a live repro.
- `--target` (path, optional): narrow static analysis to one file/dir.

## Expected Outputs

JSON: `{ "reproduced": boolean, "confidence": "high"|"low"|"none", "rootCause": string | null, "evidence": string[], "suggestedNextSkill": string }`.
`evidence` is an ordered list of file:line references and the relevant
snippet or output that led to the conclusion.

## Side Effects and Warnings

- `--repro` executes an arbitrary shell command via `bash` — requires `ask`
  permission and runs in the real project environment, including any side
  effects that command has (database writes, network calls). Use a repro
  command that's safe to run repeatedly.
- Read-only against source files — never edits or deletes anything.
- Static-analysis-only results (no `--repro` given) are inherently lower
  confidence; `confidence: "low"` should not be treated as a confirmed
  diagnosis.
