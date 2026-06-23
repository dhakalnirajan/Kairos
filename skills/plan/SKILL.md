---
name: "plan"
version: "1.0.0"
description: "Turns a feature request or bug report into a sequenced, reviewable implementation plan before any code is written"
author: "harness-core"
category: "automation"
tools:
  - read_file
  - glob
  - grep
  - write_file
permissions:
  - allow: [read_file, glob, grep]
  - ask: [write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`plan` reads a task description plus the surrounding codebase and produces a
written implementation plan: affected files, the order of changes, risk
points, and a checklist the agent (or a human) can execute against. It does
not write or modify source files. Its only output is a plan document.

The point of this skill is to separate "deciding what to do" from "doing it."
Plans are cheap to review and cheap to discard; half-finished code changes
are not. Running `plan` before `code-generation`, `refactoring`, or `tdd`
gives a human a checkpoint to catch a wrong approach before any diff exists.

## Behavior Patterns

- Reads the task description and greps/globs the repository to identify
  files likely to be touched — it does not assume file locations from the
  prompt alone.
- Breaks the task into an ordered list of discrete steps, each scoped to
  roughly one logical change (one file, one function, one migration).
- Flags steps that carry risk: schema changes, public API changes, anything
  touching auth or payments, anything without existing test coverage.
- Notes open questions or ambiguities explicitly rather than silently
  picking an interpretation.
- Never edits files. If invoked with `--apply`, it still only writes the
  plan document itself, never source files.

## When to Use

- Before starting any task that touches more than one file or more than
  ~50 lines of change.
- When a task description is ambiguous and you want the ambiguity surfaced
  before work starts rather than discovered mid-implementation.
- Before handing a task to `code-generation`, `refactoring`, or `migration`,
  so those skills have a checklist to follow instead of improvising scope.
- Not needed for single-line fixes, typo corrections, or tasks already
  fully specified step-by-step by the requester.

## Example Invocations

```
/skill run plan --task "Add rate limiting to the /api/upload endpoint"
/skill run plan --task "Fix the off-by-one in pagination" --scope src/pagination/
/skill run plan --task "Migrate auth from sessions to JWT" --output references/auth-migration-plan.md
```

## Expected Inputs

- `--task` (string, required): natural-language description of the work.
- `--scope` (path, optional): restrict file discovery to a subdirectory.
- `--output` (path, optional): where to write the plan; defaults to stdout.
- `--depth` (shallow|normal|deep, optional, default `normal`): how much of
  the codebase to read before planning. `deep` reads transitively imported
  files; `shallow` only greps for keyword matches.

## Expected Outputs

A Markdown plan document with these sections: `Summary`, `Affected Files`,
`Steps` (numbered, each with rationale), `Risks`, `Open Questions`, and
`Suggested Follow-up Skills`. Returned as plain Markdown on stdout, or
written to `--output` if given. No source files are ever modified.

## Side Effects and Warnings

- Read-only against the codebase by design — `write_file` is only ever
  used for the plan document itself, and only with `ask` permission.
- Large repositories with `--depth deep` can be slow; prefer `--scope` to
  narrow the search first.
- The plan is advisory. Nothing downstream is required to follow it exactly;
  treat it as a checklist, not a contract.
