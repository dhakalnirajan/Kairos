---
name: "migration"
version: "1.0.0"
description: "Generates a timestamped, reversible SQL migration file pair (up/down) from a structured schema-change description, and validates that existing migrations in a directory are sequentially ordered with no gaps"
author: "harness-core"
category: "automation"
tools:
  - read_file
  - write_file
  - glob
permissions:
  - allow: [read_file, glob]
  - ask: [write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`migration` handles two parts of database schema change management:
generating a new timestamped migration file pair (`up.sql`/`down.sql`, or
combined depending on convention) from a structured description of the
change, and validating an existing `migrations/` directory for ordering
problems — gaps, duplicate timestamps, or an `up` migration with no
matching `down`. It does not connect to a database or run migrations;
execution is left to the project's actual migration runner (Knex,
Prisma, Alembic, etc.).

## Behavior Patterns

- `--generate` takes a structured change description (`--add-column`,
  `--drop-column`, `--create-table`, `--add-index`, repeatable) and emits
  matching `up` and `down` SQL, with `down` constructed as the structural
  inverse of `up` wherever mechanically possible (e.g. `ADD COLUMN` ↔
  `DROP COLUMN`). Operations without a safe mechanical inverse (e.g.
  `DROP TABLE`, which can't be undone without the original schema) emit a
  `down` with an explicit comment marking it as requiring manual
  attention rather than guessing.
- Filenames follow `<unix-timestamp>_<slug>.up.sql` /
  `<unix-timestamp>_<slug>.down.sql`, with the slug derived from
  `--name`.
- `--validate` reads all files in `--scope`, parses the leading timestamp
  from each filename, and reports: any `up` file with no matching `down`
  file (and vice versa), and any timestamp collisions.
- Never executes generated or existing SQL against any database
  connection — purely file generation and static validation.

## When to Use

- Adding a new schema change and wanting the up/down pair scaffolded
  consistently instead of hand-written each time.
- Periodically validating a `migrations/` directory for structural
  problems before a deploy that runs migrations.
- Not a substitute for an actual migration runner — `migration` produces
  the SQL files; running them against a real database is the project's
  existing migration tool's job.

## Example Invocations

```
/skill run migration --generate --name add_user_avatar --add-column "users.avatar_url:text" --output-dir migrations/
/skill run migration --generate --name create_orders_table --create-table "orders(id:uuid primary key, user_id:uuid, total:numeric)" --output-dir migrations/
/skill run migration --validate --scope migrations/
```

## Expected Inputs

- `--generate` (flag): generate a new migration pair.
- `--name` (string, required for `--generate`): used to build the slug.
- `--add-column` / `--drop-column` / `--create-table` / `--add-index`
  (string, repeatable, at least one required for `--generate`): structured
  change descriptors, see `references/change-syntax.md`.
- `--output-dir` (path, required for `--generate`): directory to write
  the new migration files into.
- `--validate` (flag): validate an existing migrations directory.
- `--scope` (path, required for `--validate`): directory to validate.

## Expected Outputs

`--generate`: `{ "upFile": string, "downFile": string, "manualReviewRequired": boolean }`.
`--validate`: `{ "filesChecked": number, "issues": [{ "issue": string, "files": string[] }] }`.

## Side Effects and Warnings

- `--generate` writes two new files with `ask` permission; does not
  overwrite existing files (timestamps are generated fresh each run, so
  collisions are extremely unlikely but not impossible if run twice in
  the same second — re-run if that happens).
- Generated `down` SQL for destructive operations (`DROP TABLE`, `DROP
  COLUMN` where original type/constraints aren't known) is marked
  `-- MANUAL REVIEW REQUIRED` rather than fabricated — always review
  generated down-migrations before relying on them, especially for
  anything destructive.
- Never connects to or executes against a real database under any
  circumstance.
