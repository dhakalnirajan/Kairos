---
name: "code-generation"
version: "1.0.0"
description: "Scaffolds new source files (functions, classes, API route handlers, Vue components) from a typed template plus parameters, following project naming and structure conventions"
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

`code-generation` produces new source files from a small set of built-in
templates (TypeScript function, TypeScript class, Express-style route
handler, Vue 3 SFC stub) parameterized by name and a few options. It is
deliberately template-based rather than free-form generation: the output
is predictable, lints cleanly, and follows one fixed convention per
template, which makes it suitable for scaffolding the repetitive skeleton
of a new file so the actual logic-writing (by a human or by `tdd` /
further editing) starts from a consistent base.

This is not a substitute for actually writing the feature logic — output
files contain a clearly marked implementation placeholder, never invented
business logic.

## Behavior Patterns

- Supports a fixed set of `--template` values: `ts-function`, `ts-class`,
  `route-handler`, `vue-component`. Unknown templates are rejected with the
  valid list, not silently defaulted.
- Every generated function/method body contains a single `// TODO:
  implement <name>` placeholder and a `throw new Error("not implemented")`
  (TS) — generated code never compiles to silently-wrong behavior; it fails
  loudly until implemented.
- Applies consistent naming conversion: `--name` is converted to the
  correct case per template (PascalCase for classes/components, camelCase
  for functions, kebab-case for route paths) regardless of the case it was
  given in.
- Refuses to overwrite an existing file without `--force`, same convention
  as `design-to-code`.
- Includes a matching test file stub alongside the generated file unless
  `--no-test` is passed, to nudge toward `tdd` discipline from the start.

## When to Use

- Starting a new function, class, route handler, or Vue component and
  wanting the boilerplate (imports, exports, type signatures, file
  structure) handled consistently rather than copy-pasted from another
  file and edited.
- Not for generating actual business logic — `code-generation` produces
  skeletons with placeholders, not working implementations.

## Example Invocations

```
/skill run code-generation --template ts-function --name calculateDiscount --output src/pricing/discount.ts
/skill run code-generation --template route-handler --name getUserProfile --method GET --path /api/users/:id --output src/routes/user.ts
/skill run code-generation --template vue-component --name UploadProgress --output src/components/UploadProgress.vue --no-test
```

## Expected Inputs

- `--template` (ts-function|ts-class|route-handler|vue-component,
  required).
- `--name` (string, required): base name, case-normalized per template.
- `--output` (path, required): destination file path.
- `--method` (GET|POST|PUT|DELETE|PATCH, optional, default GET): used only
  by `route-handler`.
- `--path` (string, optional): route path, used only by `route-handler`.
- `--force` (flag, optional): allow overwriting an existing file.
- `--no-test` (flag, optional): skip generating the companion test stub.

## Expected Outputs

JSON: `{ "output": string, "testFile": string | null, "template": string }`.
The generated source file(s) are written to disk.

## Side Effects and Warnings

- Writes one or two files (source + optional test stub) with `ask`
  permission; will not overwrite existing files without `--force`.
- Generated implementations always throw `not implemented` — running
  generated code without filling in the placeholder will fail loudly,
  which is intentional, not a bug.
- Template set is intentionally fixed and small; this is not a general
  free-form code generator. For anything not matching one of the four
  templates, write the file directly instead.
