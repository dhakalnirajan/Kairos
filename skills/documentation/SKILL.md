---
name: "documentation"
version: "1.0.0"
description: "Extracts exported functions, classes, and their existing JSDoc/docstrings from source files and assembles a single API reference Markdown document"
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

`documentation` reads source files, finds exported symbols (functions,
classes, interfaces/types in TypeScript), pulls any existing JSDoc-style
comment immediately preceding each one, and compiles everything into one
Markdown API reference. It does not invent documentation for undocumented
exports — those are listed with an explicit "undocumented" marker rather
than a fabricated description, since a wrong description is worse than an
honest gap.

## Behavior Patterns

- Scans `--scope` for source files matching `--include` (default
  `**/*.ts`, excluding `*.test.ts`/`*.spec.ts`).
- Identifies exports via `export function`, `export class`, `export const
  <name> = `, `export interface`, `export type`.
- For each export, looks for a `/** ... */` block comment on the
  immediately preceding non-blank line and extracts it; if none exists,
  records the symbol as undocumented rather than guessing intent from the
  name or implementation.
- Groups output by file, in the order files were discovered, with each
  file's exports in source order (not alphabetical) so the doc mirrors the
  codebase's own organization.
- Reports a summary count of documented vs. undocumented exports so doc
  coverage gaps are visible at a glance.

## When to Use

- Generating or refreshing an API reference doc for a library or internal
  module.
- Auditing documentation coverage before a release.
- Not for generating prose guides, tutorials, or README content — this
  tool only extracts and compiles what's mechanically present in the
  source as doc comments.

## Example Invocations

```
/skill run documentation --scope src/lib/ --output references/api-reference.md
/skill run documentation --scope src/utils/date.ts
/skill run documentation --scope src/ --include "**/*.ts" --output docs/API.md
```

## Expected Inputs

- `--scope` (path, required): file or directory to scan.
- `--include` (glob, optional, default `**/*.ts`): pattern for files to
  include, applied within `--scope`.
- `--output` (path, optional): where to write the compiled doc; defaults
  to stdout.

## Expected Outputs

A Markdown document grouped by file, each export listed with its
signature and extracted doc comment (or "_undocumented_"), plus a summary
line: `Documented: X / Y exports`. JSON variant available via stdout
structure when not writing to `--output`... actually output is always
Markdown; a coverage summary JSON line is also printed to stderr for
tooling that wants to parse just the numbers.

## Side Effects and Warnings

- Read-only against source files; only ever writes the compiled doc file
  itself, with `ask` permission.
- Extraction is regex-based, not a full TypeScript parser — multi-line
  type signatures or unusual export syntax (e.g. `export { foo as bar }`)
  may not be detected. Spot-check coverage numbers against expectations on
  unfamiliar codebases.
- Does not validate that extracted JSDoc is accurate or up to date relative
  to the actual implementation — it only reports what's written, not
  whether it's still true.
