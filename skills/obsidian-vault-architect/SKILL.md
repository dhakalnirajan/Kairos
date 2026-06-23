---
name: "obsidian-vault-architect"
version: "1.0.0"
description: "Scans an Obsidian vault for broken wikilinks, orphaned notes (no incoming or outgoing links), and tag inconsistencies, and can scaffold a new note from a template with correct frontmatter"
author: "harness-core"
category: "documentation"
tools:
  - read_file
  - glob
  - write_file
permissions:
  - allow: [read_file, glob]
  - ask: [write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`obsidian-vault-architect` maintains structural health of an Obsidian
vault (a directory of Markdown files linked via `[[wikilinks]]`). It
checks for broken links (a `[[Note Name]]` reference with no matching
file), orphaned notes (files with zero incoming and zero outgoing links —
candidates for either linking up or archiving), and tag format
inconsistency (mixing `#kebab-case` and `#camelCase` tags, for example).
It can also scaffold a new note with YAML frontmatter (`title`,
`created`, `tags`) pre-filled, matching the vault's existing frontmatter
convention if one is detected.

## Behavior Patterns

- `--audit` scans all `.md` files in `--vault`, extracts `[[wikilink]]`
  and `#tag` references via regex, and cross-references wikilinks against
  actual filenames (case-insensitive, matching Obsidian's own default
  resolution behavior) to find broken links.
- Orphan detection considers a note orphaned only if it has zero
  *incoming* links from other notes AND zero *outgoing* links to other
  notes — a note that links out but receives no links in is not orphaned
  by this definition, since it's still structurally connected to the
  graph, just not yet linked back.
- Tag inconsistency detection groups all tags by a normalized form
  (lowercased, hyphens/underscores/spaces stripped) and flags groups where
  more than one literal casing/separator style appears across the vault
  (e.g. `#project-status` and `#projectStatus` both present).
- `--new-note` detects the most common frontmatter key set used across a
  sample of existing notes in the vault and replicates that structure for
  the new note, falling back to a minimal `title`/`created`/`tags` set if
  no existing convention is detected (empty or very small vault).
- Never modifies or deletes existing notes; `--new-note` only ever creates
  a new file.

## When to Use

- Periodic vault maintenance to catch broken links after renaming or
  deleting notes.
- Before a large reorganization, to see which notes are already
  disconnected from the link graph.
- Creating a new note and wanting frontmatter to match the vault's
  existing convention automatically instead of copying it from another
  note by hand.

## Example Invocations

```
/skill run obsidian-vault-architect --audit --vault ~/notes
/skill run obsidian-vault-architect --new-note --vault ~/notes --title "Q3 Planning"
```

## Expected Inputs

- `--audit` (flag): run the link/tag health scan.
- `--vault` (path, required): root directory of the Obsidian vault.
- `--new-note` (flag): scaffold a new note.
- `--title` (string, required for `--new-note`): note title, also used
  for the filename.

## Expected Outputs

`--audit`: `{ "notesScanned": number, "brokenLinks": [{ "file": string, "target": string }], "orphanedNotes": string[], "tagInconsistencies": [{ "normalized": string, "variants": string[] }] }`.
`--new-note`: `{ "file": string, "frontmatterKeys": string[] }`.

## Side Effects and Warnings

- `--audit` is entirely read-only.
- `--new-note` writes one new file with `ask` permission; refuses to
  overwrite an existing note with the same generated filename.
- Wikilink resolution is filename-based and case-insensitive, matching
  Obsidian's default behavior, but does not account for configured vault
  aliases or a custom "new note location" setting — assumes a flat or
  simply-nested vault structure where filenames are unique across the
  vault.
