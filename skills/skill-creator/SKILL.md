---
name: "skill-creator"
version: "1.0.0"
description: "Scaffolds the standard folder structure and SKILL.md manifest for a brand-new skill, validating naming and required manifest fields before writing anything"
author: "harness-core"
category: "automation"
tools:
  - read_file
  - write_file
permissions:
  - allow: [read_file]
  - ask: [write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`skill-creator` is the meta-skill that scaffolds new skills into this
harness's `skills/` directory — it's how this very batch of 26 skills
would be bootstrapped programmatically. Given a name, description, and
category, it creates the full standard folder structure
(`scripts/`, `references/`, `config/`, `examples/`, `tests/`) with a
populated `SKILL.md` manifest and placeholder files in each subdirectory,
then validates the result against the manifest schema before reporting
success.

It does not register the skill with any runtime or make it executable
beyond writing the files — registration/discovery is the harness's job,
not this skill's, consistent with how every other skill in this set
treats execution as out of scope for a generation tool.

## Behavior Patterns

- Validates `--name` against `^[a-z][a-z0-9-]*$` (lowercase,
  hyphen-separated, matching every existing skill in this harness) before
  writing anything — rejects invalid names with a clear message rather
  than silently sanitizing them, since silently changing a requested name
  could cause confusion later.
- Refuses to scaffold over an existing skill directory without `--force`.
- Writes a `SKILL.md` with all required frontmatter fields populated from
  arguments (`name`, `version` defaulting to `1.0.0`, `description`,
  `author`, `category`, `entrypoint` defaulting to `scripts/run.ts`) and a
  Markdown body with the four required sections (Purpose, Behavior
  Patterns, When to Use, Example Invocations) pre-filled with TODO
  placeholders for the human/agent to complete.
- Writes a minimal but runnable `scripts/run.ts` stub (parses `--help`,
  prints a not-yet-implemented message) so the skill is immediately
  invocable without erroring, even before real logic is added.
- After writing, re-reads and validates the generated `SKILL.md`
  frontmatter parses as valid YAML with all required keys present —
  catches a malformed manifest immediately rather than discovering it
  later when the harness tries to load it.

## When to Use

- Starting a new skill for this harness and wanting the structural
  boilerplate (folders, manifest skeleton, placeholder script) handled
  consistently rather than copied from an existing skill and hand-edited.
- Not for modifying an existing skill — this tool only creates new skill
  directories from scratch.

## Example Invocations

```
/skill run skill-creator --name api-rate-limiter --description "Checks API endpoints for missing rate limiting" --category analysis
/skill run skill-creator --name log-parser --description "Parses structured logs for error patterns" --category analysis --author "jane"
```

## Expected Inputs

- `--name` (string, required): lowercase, hyphen-separated skill name.
- `--description` (string, required): one-line description for the
  manifest.
- `--category` (analysis|automation|code-generation|deployment|testing|documentation,
  required): must match one of the categories used across this harness.
- `--author` (string, optional, default `harness-core`).
- `--skills-dir` (path, optional, default `..`): where to create the new
  skill directory.
- `--force` (flag, optional): allow overwriting an existing skill
  directory of the same name.

## Expected Outputs

JSON: `{ "skillName": string, "path": string, "filesCreated": string[], "manifestValid": boolean }`.

## Side Effects and Warnings

- Writes a new directory tree with multiple files, requiring `ask`
  permission; will not overwrite an existing skill directory without
  `--force`.
- The generated `scripts/run.ts` is a non-functional stub (prints a
  not-implemented message) — real logic must be added separately before
  the new skill does anything useful.
- `--category` is validated against a fixed list matching this harness's
  existing convention; an unrecognized category is rejected rather than
  accepted and possibly breaking downstream tooling that expects one of
  the known values.
