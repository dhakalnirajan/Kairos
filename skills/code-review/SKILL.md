---
name: "code-review"
version: "1.0.0"
description: "Reviews a diff or file set against a checklist (correctness signals, scope creep, missing tests, naming, obvious security smells) and produces inline-style comments"
author: "harness-core"
category: "analysis"
tools:
  - read_file
  - bash
permissions:
  - allow: [read_file, bash]
  - ask: []
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Note on naming

This skill merges what were previously two separate entries, `review` and
`code-review`, describing the same workflow under different names. There is
one skill here, named `code-review`.

## Purpose

`code-review` takes a git diff (or an explicit file list) and produces a
structured set of review comments: things that look wrong, things that
look risky, and things that are missing (tests, error handling). It is
explicitly not a linter or formatter substitute — it focuses on judgment
calls a static linter wouldn't catch, like scope creep, missing test
coverage for new branches, and naming that doesn't match the codebase's
existing conventions.

It complements `security` and `performance`, which go deeper on their
respective dimensions; `code-review` is the general-purpose first pass.

## Behavior Patterns

- Defaults to reviewing `git diff` against the target branch (or working
  tree changes if no branch given) rather than requiring an explicit file
  list, so it fits naturally into a pre-commit or pre-merge step.
- Flags scope creep: files changed that don't obviously relate to the
  stated task description, if one is provided via `--task`.
- Checks whether new/changed functions have corresponding new/changed test
  files in the diff — flags additions with zero test-file changes as a
  warning, not a hard failure.
- Surfaces naming inconsistency by comparing new identifiers against
  existing naming patterns in the same file (camelCase vs snake_case
  mixing, abbreviation style).
- Comments are categorized by severity: `blocking`, `should-fix`,
  `nit`. Never auto-resolves or dismisses its own comments — that's a human
  or downstream-agent decision.
- Read-only: never modifies the reviewed files. `bash` permission is used
  only to invoke `git diff`.

## When to Use

- Before opening or merging a pull request.
- After `code-generation` or `refactoring` produces a diff, as the
  self-check step before declaring a task done.
- Not a substitute for `security` on security-sensitive changes — run both.

## Example Invocations

```
/skill run code-review
/skill run code-review --base main --task "Add rate limiting to /api/upload"
/skill run code-review --files src/auth/login.ts,src/auth/session.ts
```

## Expected Inputs

- `--base` (string, optional, default `main`): branch to diff against. Used
  unless `--files` is given.
- `--files` (comma-separated paths, optional): review specific files
  directly instead of a diff.
- `--task` (string, optional): task description, used to flag scope creep.

## Expected Outputs

JSON: `{ "filesReviewed": number, "comments": [{ "file": string, "line": number | null, "severity": "blocking"|"should-fix"|"nit", "message": string }] }`.

## Side Effects and Warnings

- Uses `bash` to run `git diff` — read-only git operation, but still
  requires the working tree to be a git repository with the given `--base`
  reachable.
- Naming-convention checks are heuristic and can produce false positives in
  files that intentionally mix styles (e.g., wrapping a snake_case external
  API). Treat `nit`-severity naming comments as suggestions.
- Does not check whether tests actually pass — pair with `testing` for that.
