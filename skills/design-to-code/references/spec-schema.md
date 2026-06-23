# Component Spec Schema

```json
{
  "name": "Card",
  "props": { "title": "string", "count": 4 },
  "children": [
    { "name": "h2", "children": ["{{ title }}"] },
    { "name": "p", "children": ["Count: {{ count }}"] }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | Element/component name. Capitalized names (`Card`) are treated as custom components and converted to kebab-case in the template (`<card>`); lowercase names (`div`, `h2`) are emitted as-is. |
| `props` | object, optional | Only meaningful on the root node. Values are used purely for type inference (see below), not rendered as literal defaults. |
| `children` | array of (spec \| string), optional | Strings are emitted verbatim as template text content — use this for `{{ interpolation }}` expressions or static text. |

## Type Inference Rules

- `number` value → `number`
- `boolean` value → `boolean`
- `string` value that looks like an integer (`"4"`) → `number`
- everything else → `string`

This is a heuristic over example values, not a schema declaration — if the
spec's example value doesn't represent the real type well (e.g. an empty
string standing in for a union type), edit the generated `interface Props`
by hand after generation.

## Output Structure

Generated `.vue` files always have exactly three blocks in this order:
`<script setup lang="ts">`, `<template>`, `<style scoped>`. The style block
contains one empty rule per unique component name found in the tree,
named via kebab-case, as a styling starting point only.
