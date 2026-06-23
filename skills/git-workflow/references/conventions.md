# Conventional Commits Reference

`git-workflow` follows the [Conventional Commits](https://www.conventionalcommits.org/)
shape: `type(scope): description`.

## Type Classification Heuristic

Applied in this priority order against `git diff --staged --name-status`:

1. Any staged file matches a test path pattern → `test`
2. Any staged file is Markdown or under `docs/` → `docs`
3. Any staged file is newly added (`A` status) → `feat`
4. Any staged file path contains "fix" or "bug" → `fix`
5. All staged changes are modifications (`M` status) to existing files → `refactor`
6. Otherwise → `chore`

This ordering means a commit that both adds a test and a new feature file
will classify as `test`, since test-file detection runs first — review the
suggested type, especially for mixed commits, before using it verbatim.

## Scope Detection

Scope is the first path segment shared by all staged files, if and only if
all staged files share the same first segment. Commits touching files
across multiple top-level directories get no scope (`scope: null`), since a
single scope label would be misleading.

## Branch Naming Pattern

Default: `^(feat|fix|chore|docs)\/[a-z0-9-]+$` — e.g. `feat/rate-limiting`,
`fix/login-500`. Override via `config/defaults.yaml` if a project uses a
different convention (ticket-number-prefixed, for example).
