---
name: "sdlc"
version: "1.0.0"
description: "Orchestrates a fixed sequence of other harness skills (plan, tdd, code-generation, testing, code-review, security) for a feature task and reports a consolidated status across all stages"
author: "harness-core"
category: "automation"
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

`sdlc` is a thin orchestrator, not a new analysis engine. It runs a fixed
pipeline — `plan` → (manual implementation gap) → `testing` →
`code-review` → `security` — against a task, invoking each skill's CLI
entrypoint via `bash` and aggregating their JSON outputs into one
consolidated status report. It exists so a full task lifecycle can be
checked with one invocation instead of remembering to run five skills in
the right order.

It deliberately does not include `code-generation` or `tdd` execution
inside the automated pipeline, since those involve writing actual
implementation code — a step that should remain an explicit, reviewed
action rather than something `sdlc` triggers as a side effect of an
orchestration run. `sdlc` runs before implementation (via `plan`) and
after implementation (via `testing`/`code-review`/`security`), with the
actual writing of code happening in between, outside this skill's control.

## Behavior Patterns

- Stage 1: invokes `plan`'s entrypoint with `--task` and reports the
  generated plan.
- Pauses there in `--plan-only` mode (the default) — the caller is
  expected to implement the plan, then re-invoke `sdlc --verify` to run
  the post-implementation stages.
- Stage 2 (`--verify` mode): invokes `testing`, `code-review` (with
  `--task` for scope-creep detection), and `security` in sequence against
  the current working tree, aggregating pass/fail per stage.
- Reports an overall `ready` boolean: true only if testing has zero
  failures, code-review has zero blocking comments, and security has zero
  critical findings.
- Stops calling subsequent stages only if a prerequisite tool itself fails
  to execute (e.g. `testing`'s script errors out) — a stage reporting
  failures (not a tool crash) does not prevent later stages from still
  running, since seeing all the data is more useful than stopping early.

## When to Use

- At the start of a feature task, to get an initial plan (`--plan-only`,
  the default).
- After implementation is believed complete, to get one consolidated
  go/no-go signal (`--verify`) instead of running testing, code-review,
  and security separately and manually combining the results.
- Not a replacement for actually reading each stage's detailed output —
  the consolidated `ready` boolean is a summary, not a substitute for
  reviewing the underlying findings.

## Example Invocations

```
/skill run sdlc --plan-only --task "Add rate limiting to /api/upload"
/skill run sdlc --verify --task "Add rate limiting to /api/upload" --base main
```

## Expected Inputs

- `--plan-only` (flag, default mode if neither flag given): run only the
  planning stage.
- `--verify` (flag): run the post-implementation verification stages.
- `--task` (string, required): task description, passed through to `plan`
  and `code-review`.
- `--base` (string, optional, default `main`): passed through to
  `code-review` for diff scoping.
- `--skills-dir` (path, optional, default `..`): path to the parent
  `skills/` directory containing the other skill folders to invoke.

## Expected Outputs

`--plan-only`: `{ "stage": "plan", "output": <plan skill's JSON-ish output captured as string> }`.
`--verify`: `{ "ready": boolean, "stages": { "testing": {...}, "codeReview": {...}, "security": {...} } }`.

## Side Effects and Warnings

- Invokes other skills' entrypoints via `bash` (`ask` permission) — this
  means `sdlc`'s side effects are the union of whatever the invoked
  stages do (e.g. `testing` executes the real test suite).
- Assumes sibling skill directories (`../plan`, `../testing`,
  `../code-review`, `../security`) exist relative to `--skills-dir`; if
  the harness's skill layout differs, pass `--skills-dir` explicitly.
- The `ready` boolean is a coarse summary gate — always inspect
  `stages.*` for the actual findings before treating `ready: true` as a
  full sign-off.
