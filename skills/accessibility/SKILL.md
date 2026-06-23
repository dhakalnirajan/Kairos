---
name: "accessibility"
version: "1.0.0"
description: "Scans Vue/HTML templates for common WCAG-relevant issues: missing alt text, unlabeled form inputs, non-semantic clickable divs, and missing ARIA on custom interactive elements"
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

`accessibility` runs a static scan of Vue SFC templates and raw HTML for
the highest-frequency, highest-impact accessibility issues: images without
`alt`, form inputs without an associated label, `<div>`/`<span>` elements
with click handlers but no keyboard handler or role, and missing `aria-*`
attributes on custom interactive components. It maps each finding to the
relevant WCAG success criterion for reference, but it is not a substitute
for a full WCAG audit, automated tools like axe-core, or actual screen
reader testing — those catch things this pattern-based scan cannot.

## Behavior Patterns

- Scans `<template>` blocks in `.vue` files and full content of `.html`
  files for element-level issues using tag/attribute pattern matching.
- `<img>` without `alt` (or with `alt=""` on a non-decorative-looking
  image, heuristically — images inside `<button>`/`<a>` with no other
  text content) is flagged.
- `<input>`, `<select>`, `<textarea>` without a matching `<label
  for="...">`, an `aria-label`, or an `aria-labelledby` is flagged.
- `<div>` or `<span>` with `@click`/`onclick` but no `@keydown`/`onkeydown`
  and no `role` attribute is flagged — clickable non-semantic elements
  are invisible to keyboard-only and screen-reader users without these.
- Findings are tagged with the relevant WCAG criterion (e.g. "1.1.1 Non-
  text Content", "4.1.2 Name, Role, Value") so they can be prioritized
  against a specific compliance target if one exists.
- Read-only; produces a report only.

## When to Use

- Before shipping new UI, especially forms and custom interactive
  components.
- As a fast local pre-check before running a heavier tool like axe-core or
  Lighthouse in CI.
- Not sufficient on its own for legal/compliance-grade accessibility
  audits — pair with automated tools and, ideally, real assistive
  technology testing.

## Example Invocations

```
/skill run accessibility --scope src/components/
/skill run accessibility --scope src/components/UploadForm.vue
```

## Expected Inputs

- `--scope` (path, required): file or directory to scan (`.vue` or
  `.html` files).

## Expected Outputs

JSON: `{ "scanned": number, "findings": [{ "file": string, "line": number, "issue": string, "wcagCriterion": string, "severity": "high"|"medium" }] }`.

## Side Effects and Warnings

- Entirely read-only and pattern-based, not a real DOM/accessibility-tree
  analysis — it cannot evaluate computed contrast ratios, actual focus
  order, or dynamic ARIA state changes.
- Will produce false positives on intentionally decorative images using
  `alt=""` correctly, and on custom components that handle accessibility
  internally (e.g. a UI library component that already manages
  keyboard/ARIA behavior under the hood). Review findings rather than
  treating every hit as a confirmed violation.
- Complements, does not replace, `axe-core`/Lighthouse/manual screen
  reader testing for compliance-grade verification.
