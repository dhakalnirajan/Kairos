# Manifest Validation Rules

## Name Validation

`--name` must match `^[a-z][a-z0-9-]*$`: lowercase start, lowercase
letters/digits/hyphens only. This matches the naming convention used by
every skill already in this harness (`code-review`, `git-workflow`,
`design-to-code`, etc.). Invalid names are rejected outright, not
auto-corrected — auto-correcting could silently produce a different skill
name than what was actually intended.

## Category Validation

`--category` must be one of: `analysis`, `automation`, `code-generation`,
`deployment`, `testing`, `documentation`. This fixed list matches the
categories already used across this harness's existing skills. A new
category isn't rejected because it's wrong in some absolute sense — it's
rejected because introducing an unlisted category here, in one skill's
manifest, without updating this shared list first, would create
inconsistency that downstream tooling (anything that groups/filters
skills by category) isn't expecting.

## Post-Write Validation

After writing `SKILL.md`, `skill-creator` re-reads the file and parses
the YAML frontmatter block (between the `---` markers) with a simple
line-based parser, checking that all of `name`, `version`, `description`,
`author`, `category`, `entrypoint` are present and non-empty. This is a
shallow validation — it does not validate `tools`, `permissions`, or
`dependencies` structure, since those are freeform per-skill. The intent
is to catch a fundamentally broken manifest (missing required scalar
fields) immediately, not to be a full schema validator.

## What Gets Scaffolded vs. What Doesn't

Scaffolded: full directory structure, populated `SKILL.md` with TODO
section placeholders, a runnable-but-stub `scripts/run.ts` that exits
non-zero with a clear "not implemented" message, placeholder files in
`config/`, `references/`, `examples/`, `tests/`.

Not scaffolded: any actual skill logic, any test assertions beyond a
deliberately-failing placeholder (so an unedited scaffolded skill's test
suite fails loudly rather than silently reporting false success), any
registration with the harness's skill-discovery mechanism.
