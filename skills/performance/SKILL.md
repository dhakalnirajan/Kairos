---
name: "performance"
version: "1.0.0"
description: "Profiles a given command or scans code for common performance anti-patterns (N+1 queries, synchronous I/O in hot paths, unbounded loops over unbounded data) and reports findings with measurements where possible"
author: "harness-core"
category: "analysis"
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

`performance` has two modes. In measurement mode, it runs a given command
under timing and reports wall-clock duration, useful for before/after
comparison around a change. In static mode, it scans code for known
anti-pattern shapes — queries inside loops, synchronous fs calls, missing
pagination/limits on collection fetches — and reports them with file:line
references. It does not change code or suggest specific rewrites; that's
`refactoring`'s job once a hotspot is confirmed.

## Behavior Patterns

- `--measure <command>` runs the command N times (default 3, configurable),
  discards the first run as warmup, and reports min/max/mean wall time —
  cold-start variance is real and a single run is not a reliable number.
- `--scan <path>` runs static pattern detection without executing anything.
- N+1 detection looks for a query/fetch call appearing textually inside a
  loop body (`for`, `forEach`, `map`, `while`) — this is the single highest-
  value, most common anti-pattern across most backend codebases.
- Synchronous I/O detection flags `readFileSync`, `execSync`, and similar
  blocking calls found inside functions that are themselves async or that
  appear to be request handlers (heuristic: file path includes
  `route`/`handler`/`controller`).
- Findings include a one-line "why this matters" note, not a prescribed
  fix — keeping the line between diagnosis and remedy intentional.

## When to Use

- `--measure`: before and after a suspected-slow change, to get an actual
  number instead of a feeling.
- `--scan`: periodically, or before a release, to catch anti-patterns that
  crept in.
- Not a replacement for a real profiler (flamegraphs, CPU sampling) on
  genuinely hard performance problems — this is a fast first pass.

## Example Invocations

```
/skill run performance --measure "bun run src/server.ts --once" --runs 5
/skill run performance --scan src/api/
/skill run performance --scan src/db/queries.ts
```

## Expected Inputs

- `--measure` (string, optional): a shell command to time.
- `--runs` (number, optional, default 3): repetitions for `--measure`.
- `--scan` (path, optional): directory or file for static anti-pattern scan.
- Exactly one of `--measure` or `--scan` must be given.

## Expected Outputs

For `--measure`: `{ "command": string, "runs": number, "minMs": number, "maxMs": number, "meanMs": number }`.
For `--scan`: `{ "scanned": number, "findings": [{ "file": string, "line": number, "pattern": "n-plus-one"|"sync-io-in-handler"|"unbounded-fetch", "note": string }] }`.

## Side Effects and Warnings

- `--measure` executes the given command via `bash` with `ask` permission —
  this runs real code, potentially with real side effects (network calls,
  writes). Prefer idempotent or dry-run commands where possible.
- `--scan` is read-only and pattern-based, not a true data-flow analysis —
  it can miss anti-patterns that don't match the textual shapes it looks
  for, and can flag intentional cases (e.g. a deliberately batched loop
  with a single query hoisted above it but body still matching the regex).
- Timing measurements on a loaded or shared machine will be noisy; treat
  `--measure` results as directional, not absolute, unless run on a
  dedicated benchmark environment.
