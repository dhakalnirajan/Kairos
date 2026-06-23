---
name: "refactoring"
version: "1.0.0"
description: "Applies named structural refactoring patterns (extract-function, rename-symbol, inline-variable, extract-constant) to a specified file and line, writing the transformed result back to the file"
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

`refactoring` applies a small, precisely-scoped structural transformation
to source code: extracting a line range into a named function, renaming a
symbol within a file, inlining a single-use variable, or extracting a
magic literal into a named constant. Each transformation is named,
targeted (file + line or line range), and produces a diff preview before
asking permission to write the modified file back. The goal is to make
small, safe, behavior-preserving changes that should not require a test
suite to pass any differently — running `testing` before and after is the
verification step, not something `refactoring` does itself.

These are deliberately the simplest, most mechanical refactors. Larger
restructuring (moving between files, changing a module's public API,
splitting a class) is too context-dependent for a pattern-match-based
tool and belongs under human or more targeted agent direction.

## Behavior Patterns

- `extract-function`: takes a `--range start:end` (line numbers,
  inclusive), wraps those lines as the body of a new function named
  `--new-name`, replaces the original range with a call to the new
  function, and inserts the function definition immediately above the
  call site's enclosing function.
- `rename-symbol`: performs a whole-file find-and-replace of
  `--old-name` → `--new-name` as an identifier (word-boundary match,
  not substring), previewing the diff before writing.
- `inline-variable`: finds the single assignment of `--old-name` in the
  target line range, substitutes its right-hand side for each reference
  to `--old-name` in the same scope, and removes the assignment. Refuses
  if the variable has more than one assignment (not safe to inline).
- `extract-constant`: finds a quoted string or numeric literal at
  `--line` matching `--old-name` (or `--value`), extracts it to a
  `const` declaration named `--new-name` at the top of the enclosing
  scope, and replaces all occurrences of that literal value in the file.
- Every transformation first prints a unified diff to stdout and
  requires `ask` permission before writing — the caller sees exactly what
  will change before it happens.

## When to Use

- After `simplify` flags a long function: use `extract-function` on the
  flagged line range to start decomposing it.
- After `code-review` flags a magic string literal: use
  `extract-constant` to make it a named constant.
- Before a larger change: `rename-symbol` to clean up a confusing name
  first, making the subsequent change easier to reason about.
- Not appropriate for: moving symbols between files, changing a public
  API's shape, or any refactor that changes observable behavior (even
  subtly) — those require human judgment about tests and external
  consumers.

## Example Invocations

```
/skill run refactoring --op extract-function --file src/upload.ts --range 12:24 --new-name validateUploadPayload
/skill run refactoring --op rename-symbol --file src/user.ts --old-name usr --new-name user
/skill run refactoring --op extract-constant --file src/api.ts --line 8 --value "application/json" --new-name CONTENT_TYPE_JSON
```

## Expected Inputs

- `--op` (extract-function|rename-symbol|inline-variable|extract-constant,
  required).
- `--file` (path, required): file to transform.
- `--range` (start:end, required for `extract-function` and
  `inline-variable`): inclusive line range.
- `--line` (number, required for `extract-constant`): line containing the
  literal to extract.
- `--old-name` (string, required for `rename-symbol`, `inline-variable`):
  identifier to replace or inline.
- `--new-name` (string, required for `extract-function`, `rename-symbol`,
  `extract-constant`): new identifier or function name.
- `--value` (string, optional for `extract-constant`): literal value if
  it differs from `--old-name`.

## Expected Outputs

A unified diff printed to stdout, then the file is updated in place with
`ask` permission. Also returns JSON: `{ "op": string, "file": string, "linesChanged": number }`.

## Side Effects and Warnings

- Writes the modified file back in place with `ask` permission — the
  original content is replaced, not duplicated.
- No backup of the original is made by default — run from a git working
  tree so `git diff` and `git checkout -- <file>` provide a safety net.
- Transformations are text-based, not AST-based — they can be fooled by
  unusual formatting, template literals spanning multiple lines, or
  identifiers appearing inside string literals or comments.
  `rename-symbol`'s word-boundary matching reduces false positives but
  does not eliminate them entirely (e.g. a comment mentioning the old
  name will also be renamed).
- Always run `testing` after applying a refactoring to confirm no
  behavior change occurred, especially for `inline-variable` and
  `extract-function`, where incorrect scope assumptions could break code.
