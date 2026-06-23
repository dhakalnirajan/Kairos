---
name: "i18n"
version: "1.0.0"
description: "Finds hardcoded user-facing strings in source/templates not routed through an i18n function, and checks translation key files for missing/orphaned keys across locales"
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

`i18n` has two checks. `--find-hardcoded` scans source/template files for
string literals that look like user-facing text (capitalized, multi-word,
not obviously a CSS class or identifier) appearing outside a translation
function call (`t(...)`, `$t(...)`, `i18n.t(...)`), flagging them as
candidates for extraction. `--check-keys` compares a base locale's
translation JSON file against one or more other locale files and reports
keys missing in each target locale, plus keys present in a target but not
in the base (orphaned).

## Behavior Patterns

- Hardcoded-string detection looks at template text content and string
  literal arguments to common UI-producing calls (e.g. `placeholder=`,
  `title=`, button/label text nodes), filtering out strings that are
  clearly not prose: all-lowercase single words, strings matching a CSS
  class/id shape, strings that are already wrapped in a `t(...)`/`$t(...)`
  call.
- A string is flagged only if it contains a space and starts with an
  uppercase letter or is entirely in a natural-language shape — pure
  heuristic, tuned to minimize false positives on things like variable
  names or CSS values rather than catch every possible case.
- `--check-keys` flattens nested JSON translation objects into dot-path
  keys (`auth.login.title`) before comparing, so nested structures are
  handled correctly, not just top-level keys.
- Missing-key findings are categorized per locale file so a single run
  covers all configured locales against the base in one pass.

## When to Use

- Auditing an existing or growing codebase for strings that were never
  routed through the i18n system — common after a feature is built
  quickly and i18n is added retroactively.
- Verifying translation completeness before a release, especially after
  adding new UI copy to the base locale.
- Not a translation tool itself — it finds gaps, it does not translate
  text. Use a human translator or a dedicated translation service for
  that.

## Example Invocations

```
/skill run i18n --find-hardcoded --scope src/components/
/skill run i18n --check-keys --base locales/en.json --target locales/es.json,locales/fr.json
```

## Expected Inputs

- `--find-hardcoded` (flag): run the hardcoded-string scan.
- `--scope` (path, required for `--find-hardcoded`): files/dir to scan.
- `--check-keys` (flag): run the translation key comparison.
- `--base` (path, required for `--check-keys`): base locale JSON file.
- `--target` (comma-separated paths, required for `--check-keys`): locale
  files to compare against base.
- Exactly one of `--find-hardcoded` or `--check-keys` per invocation.

## Expected Outputs

`--find-hardcoded`: `{ "scanned": number, "candidates": [{ "file": string, "line": number, "text": string }] }`.
`--check-keys`: `{ "base": string, "results": [{ "locale": string, "missingKeys": string[], "orphanedKeys": string[] }] }`.

## Side Effects and Warnings

- Entirely read-only.
- Hardcoded-string detection is heuristic and will have both false
  positives (legitimate non-translatable strings like log messages) and
  false negatives (strings built via concatenation/interpolation that
  don't match the simple literal patterns checked). Treat results as a
  worklist to review, not a definitive list.
- Translation key comparison assumes valid JSON files; malformed JSON in
  any locale file causes that file's comparison to be skipped with an
  error noted in output, not a script crash.
