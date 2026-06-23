---
name: "code-analyzer"
version: "1.0.0"
description: "Builds a dependency graph of imports/requires across a codebase and reports circular dependencies, unused exports, and high-fan-in/fan-out modules"
author: "harness-core"
category: "analysis"
tools:
  - read_file
  - glob
permissions:
  - allow: [read_file, glob]
  - ask: []
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`code-analyzer` answers structural questions about a codebase that are
hard to see by reading individual files: which modules import each other
in a cycle, which exported symbols are never imported anywhere else
(candidates for removal), and which files have unusually high fan-in
(many modules depend on it — a change-risk hotspot) or fan-out (depends on
many things — a coupling smell). It builds this purely from static
import/require statement parsing, not from running the code.

## Behavior Patterns

- Parses `import ... from "..."` and `require("...")` statements,
  resolving relative imports to actual files within `--scope`; external
  package imports are recorded but not followed.
- Detects cycles via depth-first search over the resolved import graph,
  reporting each distinct cycle as an ordered list of files.
- Cross-references `export` statements against all detected imports across
  the scope to flag exports with zero importers anywhere in scope —
  labeled as candidates, since an export might be a public API entry point
  consumed outside the scanned scope.
- Computes fan-in (count of files importing this file) and fan-out (count
  of files this file imports) per file, and flags files above
  configurable percentile thresholds as hotspots.
- Entirely read-only; produces a report only.

## When to Use

- Investigating why a change in one file seems to require touching many
  others (high fan-in on the changed file is a likely cause).
- Before a refactor, to find circular dependencies that should probably be
  broken first.
- Periodic dead-code audits via the unused-exports report.
- Not a runtime profiler or call-graph tool — this is purely static
  import-statement analysis, so dynamically constructed import paths or
  reflection-based loading will not be captured.

## Example Invocations

```
/skill run code-analyzer --scope src/ --check cycles
/skill run code-analyzer --scope src/ --check unused-exports
/skill run code-analyzer --scope src/ --check hotspots --top 10
```

## Expected Inputs

- `--scope` (path, required): root directory to analyze.
- `--check` (cycles|unused-exports|hotspots|all, optional, default `all`):
  which analysis to run.
- `--top` (number, optional): limit hotspot results to top N by fan-in +
  fan-out.

## Expected Outputs

JSON: `{ "filesAnalyzed": number, "cycles": string[][], "unusedExports": [{ "file": string, "export": string }], "hotspots": [{ "file": string, "fanIn": number, "fanOut": number }] }`.
Sections not requested via `--check` are omitted (empty array) rather than
computed unnecessarily.

## Side Effects and Warnings

- Entirely read-only and dependency-free.
- Import resolution only follows relative paths (`./`, `../`) within
  `--scope`; it cannot resolve path aliases (`@/utils`) unless they happen
  to also exist as literal relative paths, and does not read `tsconfig.json`
  path mappings.
- "Unused exports" is scoped to `--scope` only — an export consumed by code
  outside the scanned directory (e.g. a published package's public API)
  will be incorrectly flagged. Treat unused-export findings as candidates
  to investigate, not as confirmed dead code.
