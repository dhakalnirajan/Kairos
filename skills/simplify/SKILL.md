---
name: "simplify"
version: "1.0.0"
description: "Flags overly complex code (deep nesting, long functions, high cyclomatic complexity) without rewriting it, for human or agent-directed cleanup"
author: "harness-core"
category: "analysis"
tools:
  - read_file
  - glob
permissions:
  - allow: [read_file, glob]
  - ask: []
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`simplify` measures structural complexity — nesting depth, function length,
branch count, parameter count — and reports specific offending locations
ranked by severity. It does not propose or apply simplifications itself;
that's deliberate, since automated "simplification" rewrites are exactly
the kind of change that benefits from a human or a more targeted
`refactoring` pass reviewing the actual logic, not just the metrics.

Think of `simplify` as a smoke detector, not a fire extinguisher.

## Behavior Patterns

- Computes four metrics per function: cyclomatic complexity (branch count
  + 1), max nesting depth, line count, and parameter count.
- Flags a function when it crosses a configurable threshold on any single
  metric — flagging is OR across metrics, not AND, so a short function with
  ten parameters is flagged even if its complexity score is low.
- Reports findings sorted by severity (how far past threshold), not by file
  order, so the worst offenders surface first.
- Operates purely on syntax-level heuristics (brace/keyword counting), not
  a full AST parse — fast and dependency-free, but can be fooled by unusual
  formatting. Treat results as a strong signal, not ground truth.
- Read-only. Never modifies files.

## When to Use

- Periodically across a codebase to find cleanup candidates.
- Before starting a `refactoring` pass, to get an objective starting list
  instead of refactoring by feel.
- As a pre-merge check to catch a PR introducing a 200-line function.
- Not useful for judging naming, abstraction quality, or architectural
  fit — those are `code-review` concerns, not structural metrics.

## Example Invocations

```
/skill run simplify --scope src/
/skill run simplify --scope src/handlers/upload.ts --threshold-complexity 8
/skill run simplify --scope . --top 5
```

## Expected Inputs

- `--scope` (path, required): file or directory to analyze.
- `--threshold-complexity` (number, optional, default 10): cyclomatic
  complexity flag threshold.
- `--threshold-length` (number, optional, default 50): line count flag
  threshold per function.
- `--threshold-depth` (number, optional, default 4): nesting depth flag
  threshold.
- `--threshold-params` (number, optional, default 5): parameter count flag
  threshold.
- `--top` (number, optional): limit output to the N worst offenders.

## Expected Outputs

JSON: `{ "scanned": number, "flagged": [{ "file": string, "function": string, "line": number, "complexity": number, "depth": number, "length": number, "params": number, "reasons": string[] }] }`,
sorted by severity descending.

## Side Effects and Warnings

- Heuristic, not a true parser — generated code, heavily macro'd code, or
  unusual brace styles can produce inaccurate counts. Spot-check flagged
  results before trusting them blindly.
- No side effects; entirely read-only.
- Large scopes can take a few seconds; prefer narrowing `--scope` for fast
  iteration during active cleanup work.
