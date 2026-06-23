---
name: "git-workflow"
version: "1.0.0"
description: "Generates conventional-commit messages from staged changes, checks branch naming against convention, and prepares PR descriptions from commit history"
author: "harness-core"
category: "automation"
tools:
  - bash
permissions:
  - allow: []
  - ask: [bash]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`git-workflow` handles the repetitive parts of git hygiene: writing a
conventional-commit-formatted message from the actual staged diff (not a
generic placeholder), validating a branch name against a configurable
naming convention, and assembling a PR description by summarizing commits
since a base branch. It runs `git` commands directly but never commits,
pushes, or creates branches on its own — every git-mutating action is
output as a suggested command, not executed.

## Behavior Patterns

- `--commit-message` reads `git diff --staged`, classifies the change type
  (feat/fix/docs/refactor/test/chore) by looking at which files changed and
  what kind of diff hunks are present, and produces a Conventional Commits
  formatted message: `type(scope): summary`.
- `--check-branch` validates the current branch name against a regex
  pattern (default `^(feat|fix|chore|docs)\/[a-z0-9-]+$`), configurable in
  `config/defaults.yaml`.
- `--pr-description` reads `git log <base>..HEAD --oneline` and groups
  commits by their conventional-commit type into a structured PR body with
  a Summary and a Changes section.
- Classification is heuristic (file extension + path conventions + diff
  content keywords), not guaranteed correct — always intended as a strong
  draft to edit, not a final answer to commit unread.
- Never runs `git commit`, `git push`, `git branch`, or any other
  state-mutating git command. Read-only against git history.

## When to Use

- Before committing, to get a properly formatted message drafted from the
  actual diff instead of writing one from memory of what you changed.
- Before opening a PR, to get a first-draft description from commit
  history instead of starting from a blank box.
- To validate branch naming in a pre-push hook or CI check.

## Example Invocations

```
/skill run git-workflow --commit-message
/skill run git-workflow --check-branch
/skill run git-workflow --pr-description --base main
```

## Expected Inputs

- `--commit-message` (flag): generate a commit message from staged changes.
- `--check-branch` (flag): validate current branch name.
- `--pr-description` (flag): generate a PR description.
- `--base` (string, optional, default `main`): base branch for
  `--pr-description`.
- Exactly one action flag must be given per invocation.

## Expected Outputs

- `--commit-message`: `{ "type": string, "scope": string | null, "message": string, "suggestedCommand": string }`.
- `--check-branch`: `{ "branch": string, "valid": boolean, "pattern": string }`.
- `--pr-description`: `{ "base": string, "commitCount": number, "description": string }` (description is Markdown).

## Side Effects and Warnings

- Reads git state via `bash` (`ask` permission) but never mutates it —
  no commits, pushes, branch creation, or checkout performed by this skill.
- `--commit-message` requires staged changes to exist (`git diff --staged`
  non-empty); with nothing staged it reports an error rather than a guess.
- Commit-type classification is heuristic and should be treated as a draft,
  especially for commits touching multiple concern areas at once.
