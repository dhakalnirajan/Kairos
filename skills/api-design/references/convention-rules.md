# Convention Rules and Breaking-Change Semantics

## Lint Rules

**Plural collection nouns.** Each non-placeholder path segment is checked
for a trailing "s", with a configurable exception list (`health`,
`metrics`, `login`, `logout`, `search` — singular-by-convention endpoints
that aren't resource collections). This is a simple suffix heuristic, not
real pluralization logic — it will false-positive on naturally singular
collection names and false-negative on irregular plurals; review findings
rather than treating every hit as definitely wrong.

**Verb-in-path.** Flags a leading path segment matching common verb
prefixes (`get`, `create`, `update`, `delete`, `fetch`, `activate`,
`deactivate`) followed by a capital letter, suggesting an RPC-style
endpoint name rather than a resource-oriented one. Action sub-resources
like `/users/{id}/activate` are intentionally NOT flagged by this rule,
since the verb appears as a non-leading segment after a resource
identifier — that's a conventional and accepted REST pattern for actions
that don't map cleanly to CRUD.

**Status code conventions.** `POST` is expected to return `201 Created`
for resource-creation endpoints; `DELETE` is expected to return
`204 No Content`. Only flagged as a warning (not error) when status is
below 400, since plenty of legitimate `POST` endpoints (e.g. a
non-creating action) intentionally return `200`.

## Diff Breaking-Change Rules

| Change | Classification |
|---|---|
| Endpoint or method removed | Breaking |
| Previously-optional request field becomes required | Breaking |
| Response field removed | Breaking |
| Response field type changed | Breaking |
| New endpoint, method, or optional field added | Non-breaking |
| Response field added | Non-breaking |

This follows standard API-compatibility reasoning: anything that would
cause a well-behaved existing client (one that doesn't send fields it
doesn't know about, and doesn't choke on unknown extra response fields)
to start failing is breaking; purely additive changes are not.

## Spec Format Assumption

`--diff` expects OpenAPI 3.x-shaped JSON: a top-level `paths` object,
each path containing lowercase HTTP method keys, each operation having an
optional `requestBody.content["application/json"].schema.required` array
and `responses["200"].content["application/json"].schema.properties`
object. Specs not matching this shape (Swagger 2.0, YAML, non-JSON
formats) need conversion first.
