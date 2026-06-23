# Change Descriptor Syntax

## --add-column

Format: `table.column:type` (type optional, defaults to `text`).

```
--add-column "users.avatar_url:text"
--add-column "orders.priority:integer"
```

Generates a mechanical inverse (`DROP COLUMN`) for `down` — safe in both
directions since the type is known at generation time.

## --drop-column

Format: `table.column`.

```
--drop-column "users.legacy_field"
```

**No safe automatic inverse.** The original column's type, default, and
constraints aren't known to this tool at generation time, so `down` is
emitted as a `-- MANUAL REVIEW REQUIRED` comment rather than a guessed
`ADD COLUMN` statement. Fill in the correct re-add statement by hand if
this migration ever needs to be rolled back.

## --create-table

Format: `table_name(col1 type constraints, col2 type constraints, ...)`.

```
--create-table "orders(id uuid primary key, user_id uuid, total numeric)"
```

Generates `DROP TABLE` as the mechanical inverse — safe, since dropping a
table you just created is unambiguous.

## --add-index

Format: `table.column`.

```
--add-index "orders.user_id"
```

Generated index name: `idx_<table>_<column>`. Inverse is `DROP INDEX` by
that same generated name.

## Repeatability

All four flags are repeatable and can be combined in a single
`--generate` call — useful for a migration that, e.g., creates a table and
immediately adds an index on it. Order in the generated SQL file follows
flag-type order (columns, then drops, then tables, then indexes), not
command-line argument order.
