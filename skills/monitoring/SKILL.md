---
name: "monitoring"
version: "1.0.0"
description: "Scans request handlers and critical functions for missing error logging/structured logging, and generates a starter set of health-check and metrics-endpoint boilerplate"
author: "harness-core"
category: "deployment"
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

`monitoring` does two things. `--audit` scans handler/controller files for
`catch` blocks that don't log the caught error anywhere (a silent-failure
pattern that makes production issues invisible) and for async functions
with no error handling at all. `--scaffold` generates a basic `/health`
endpoint and a minimal metrics-collection module skeleton for a given
framework, since most services need these and they're tedious
boilerplate to write from scratch each time.

This does not configure or connect to any actual monitoring backend
(Datadog, Prometheus, etc.) — `--scaffold` output is a local-only starting
point with clearly marked integration points.

## Behavior Patterns

- `--audit` flags `catch (e) { ... }` blocks whose body contains no
  `console.error`, `logger.*`, or similar call referencing the caught
  variable — an empty or logging-free catch block hides failures.
- `--audit` also flags exported `async function`s with no `try/catch`
  wrapping their body at all, as a softer (lower severity) finding, since
  unhandled rejections are often deliberately left to a global handler —
  flagged for awareness, not assumed wrong.
- `--scaffold health` generates a `/health` route returning `{ status: "ok", uptime, timestamp }` for the given framework (currently `express` or
  `vue`-adjacent Node backends).
- `--scaffold metrics` generates a minimal in-memory counter/timer module
  with clearly marked `// TODO: wire up to <your APM/metrics backend>`
  comments rather than guessing which actual backend to integrate.
- Refuses to overwrite existing scaffold output files without `--force`.

## When to Use

- `--audit`: periodically, or before a release, to catch silent error
  swallowing before it hides a production incident.
- `--scaffold`: setting up a new service that doesn't yet have basic
  health/metrics endpoints.
- Not a replacement for actually wiring up a real APM/observability
  backend — `--scaffold` output is a starting skeleton with integration
  points marked, not a finished integration.

## Example Invocations

```
/skill run monitoring --audit --scope src/routes/
/skill run monitoring --scaffold health --framework express --output src/routes/health.ts
/skill run monitoring --scaffold metrics --output src/lib/metrics.ts
```

## Expected Inputs

- `--audit` (flag): run the silent-failure scan.
- `--scope` (path, required for `--audit`): files/dir to scan.
- `--scaffold` (health|metrics, optional): which boilerplate to generate.
- `--framework` (express, optional, default `express`): target framework
  for `--scaffold health`.
- `--output` (path, required for `--scaffold`): destination file.
- `--force` (flag, optional): allow overwriting existing scaffold output.

## Expected Outputs

`--audit`: `{ "scanned": number, "findings": [{ "file": string, "line": number, "severity": "high"|"low", "issue": string }] }`.
`--scaffold`: `{ "output": string, "kind": "health"|"metrics" }`, plus the
generated file written to disk.

## Side Effects and Warnings

- `--audit` is entirely read-only.
- `--scaffold` writes a new file with `ask` permission and refuses to
  overwrite without `--force`.
- `--scaffold metrics` output is intentionally backend-agnostic and
  non-functional out of the box beyond in-memory counting — it will not
  actually report metrics anywhere until the marked TODO integration
  points are filled in.
