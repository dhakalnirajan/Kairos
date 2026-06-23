# Template Reference

## ts-function

Plain exported TypeScript function, camelCase name, single
`not implemented` throw in the body. No parameters or return type are
inferred — add those by hand after generation.

## ts-class

Exported TypeScript class, PascalCase name, empty constructor with a TODO
marker. No fields or methods beyond the constructor are generated.

## route-handler

Express-style async handler: `(req: Request, res: Response) => Promise<void>`.
camelCase function name; route path defaults to `/api/<kebab-case-name>`
unless `--path` is given explicitly. `--method` defaults to `GET` and is
recorded in a comment only — this template does not wire up actual
Express routing (`app.get(...)`), since that requires knowing the app's
router structure, which is out of scope for a template-based generator.

## vue-component

Vue 3 SFC with `<script setup lang="ts">`, a single wrapping `<div>` in
the template using a kebab-case class matching the component name, and an
empty `<style scoped>` rule for that class. No props are generated; add
`defineProps` manually, or use `design-to-code` instead if a structured
spec already exists.

## Case Conversion Rules

Applied regardless of the case `--name` was given in:
- `ts-function`, `route-handler` → camelCase
- `ts-class`, `vue-component` → PascalCase
- route paths, CSS class names → kebab-case

## Test Stub Generation

Unless `--no-test` is passed, a companion `*.test.ts` file is written next
to the generated file with a single `it.todo(...)` placeholder using
Vitest's `describe`/`it` syntax. This is a nudge toward the `tdd` skill's
discipline, not a substitute for it — the stub contains no real
assertions.
