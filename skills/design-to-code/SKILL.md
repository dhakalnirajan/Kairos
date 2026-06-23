---
name: "design-to-code"
version: "1.0.0"
description: "Converts a structured design spec (component tree described as nested JSON: element, props, children) into a Vue 3 + TypeScript single-file component skeleton"
author: "harness-core"
category: "code-generation"
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

`design-to-code` bridges a structured UI spec and a real component file. It
does not interpret images or Figma links — it takes an explicit JSON tree
(element name, props, children, text content) and emits a Vue 3
`<script setup lang="ts">` single-file component with matching template
structure, typed props, and placeholder styling hooks. The output is a
starting skeleton meant for a human or `code-generation` to flesh out, not
a finished, pixel-perfect component.

Vue 3 + TypeScript is the fixed target here, matching this project's
default web stack convention — this skill does not attempt to support
arbitrary frontend frameworks.

## Behavior Patterns

- Reads a JSON spec describing a component tree: `{ "name": string, "props": Record<string, string>, "children": Spec[] | string }`.
- Generates a `<script setup lang="ts">` block with a typed `defineProps`
  call inferred from the top-level `props` object's value types (string
  literal types become `string`, numeric strings become `number`, etc).
- Generates a matching `<template>` block with nested elements reflecting
  the spec tree, using kebab-case for any custom component names and
  standard HTML tags as-is.
- Emits a `<style scoped>` block with empty rule blocks (selectors only,
  no declarations) for each named component in the tree, as styling
  placeholders.
- Refuses to overwrite an existing file at `--output` without `--force`,
  to avoid silently clobbering hand-edited components.

## When to Use

- Turning an agreed-upon UI spec or wireframe description into a starting
  component file instead of typing boilerplate by hand.
- Not suitable for pixel-level visual fidelity from an image — this tool
  has no image understanding; the input must already be structured JSON.

## Example Invocations

```
/skill run design-to-code --spec references/upload-form-spec.json --output src/components/UploadForm.vue
/skill run design-to-code --spec examples/input.md --output src/components/Card.vue --force
```

## Expected Inputs

- `--spec` (path, required): path to a JSON file matching the component
  tree schema (see `references/spec-schema.md`).
- `--output` (path, required): destination `.vue` file path.
- `--force` (flag, optional): allow overwriting an existing output file.

## Expected Outputs

A `.vue` single-file component written to `--output`, and a JSON summary
to stdout: `{ "output": string, "componentCount": number, "propsInferred": string[] }`.

## Side Effects and Warnings

- Writes a new source file — requires `ask` permission, and will not
  overwrite an existing file unless `--force` is explicitly passed.
- Prop type inference is a best-effort guess from example values in the
  spec, not a real type system — review and tighten generated types before
  shipping.
- Generated `<style scoped>` blocks are empty placeholders; this tool does
  not attempt to infer visual styling from the spec.
