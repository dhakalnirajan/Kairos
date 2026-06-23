---
name: "api-design"
version: "1.0.0"
description: "Validates a set of described REST endpoints against naming/verb/status-code conventions and checks for breaking changes between two OpenAPI-shaped JSON specs"
author: "harness-core"
category: "code-generation"
tools:
  - read_file
permissions:
  - allow: [read_file]
  - ask: []
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`api-design` has two checks. `--lint` validates a structured list of
endpoint descriptions against REST convention rules: plural resource
nouns in paths, correct HTTP verb for the described action (no `GET` that
mutates state, no `POST` for a pure fetch), and a sane status code for
the response (`201` for creation, `204` for no-content responses, not
`200` for everything). `--diff` compares two OpenAPI-shaped JSON spec
files and reports breaking changes: removed endpoints, removed required
request fields that were previously optional-becoming-required, and
changed response field types — the changes that would actually break an
existing client.

## Behavior Patterns

- `--lint` takes endpoint descriptors (`METHOD /path -> status`,
  repeatable) and checks: path uses plural nouns for collections (`/users`
  not `/user`), path uses `{id}`-style placeholders not embedded verbs
  (`/users/{id}/activate` is fine, `/activateUser` is flagged), method
  matches the apparent intent from the path/description if a
  `--description` is paired with the endpoint, and status code is
  conventional for the method (`POST` defaults to expecting `201`, `DELETE`
  to `204`, flagged as a suggestion if a different code is given without
  obvious justification).
- `--diff` loads both spec files as JSON, walks `paths`, and reports:
  endpoints present in `--old` but missing in `--new` (removed —
  breaking), required fields added to a request schema that weren't
  required before (breaking for existing clients omitting them), and
  response field type changes (breaking for clients parsing the old
  type). Purely additive changes (new optional field, new endpoint) are
  not flagged.
- Every finding includes a clear breaking/non-breaking classification for
  `--diff`, and a severity (`error`|`warning`) for `--lint`, so output can
  be used as a pass/fail gate or just informational review.

## When to Use

- `--lint`: designing a new set of endpoints and wanting a consistency
  check against REST convention before implementation.
- `--diff`: before publishing a new API version, to catch accidental
  breaking changes against the previous spec.
- Not a full OpenAPI schema validator — `--diff` checks structural
  compatibility signals, not full JSON Schema correctness of each spec
  file.

## Example Invocations

```
/skill run api-design --lint --endpoint "GET /users -> 200" --endpoint "POST /user -> 200"
/skill run api-design --diff --old specs/v1.json --new specs/v2.json
```

## Expected Inputs

- `--lint` (flag): run convention checks.
- `--endpoint` (string, repeatable, for `--lint`): `METHOD /path -> status`.
- `--diff` (flag): run breaking-change comparison.
- `--old` / `--new` (path, required for `--diff`): OpenAPI-shaped JSON
  spec files, each with a top-level `paths` object.

## Expected Outputs

`--lint`: `{ "checked": number, "findings": [{ "endpoint": string, "severity": "error"|"warning", "issue": string }] }`.
`--diff`: `{ "breakingChanges": [{ "path": string, "change": string }], "nonBreakingChanges": [{ "path": string, "change": string }] }`.

## Side Effects and Warnings

- Entirely read-only.
- `--lint`'s plural-noun and verb-in-path checks are heuristic (regex
  over the path string) — exceptions exist in real-world APIs (action
  endpoints like `/users/{id}/activate` are intentionally verb-like and
  not flagged by design, but more unusual conventions may produce false
  positives).
- `--diff` only understands OpenAPI-shaped JSON with a `paths` object
  using standard `requestBody`/`responses`/`schema` structure — specs in
  other formats (YAML, Postman collections) must be converted to this
  JSON shape first.
