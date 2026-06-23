---
name: "deployment"
version: "1.0.0"
description: "Validates a project's deployment readiness (env var coverage, build script presence, Dockerfile sanity) and generates a deployment checklist; does not perform actual deploys"
author: "harness-core"
category: "deployment"
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

`deployment` checks the static preconditions for a safe deploy without
performing one. It verifies that every environment variable referenced in
source code has a corresponding entry in `.env.example` (catching the
classic "works on my machine, missing var in prod" failure), confirms a
build script exists and is runnable per `package.json`, and runs basic
Dockerfile sanity checks if one is present (non-root user, explicit base
image tag rather than `latest`, `.dockerignore` existence). It never runs
`docker build`, `docker push`, or any actual deployment command — those
are explicitly out of scope and listed as next steps in the report
instead.

## Behavior Patterns

- Scans source for `process.env.X` / `import.meta.env.X` references,
  collects the set of referenced variable names, and cross-checks against
  keys present in `.env.example` (not `.env`, which shouldn't be
  committed) — variables referenced in code but absent from
  `.env.example` are flagged as undocumented.
- Checks `package.json` for a `scripts.build` entry; flags its absence.
- If `Dockerfile` exists: flags `FROM ...:latest` (no pinned tag), flags
  absence of a `USER` directive (running as root), flags absence of a
  `.dockerignore` file alongside it.
- Produces a checklist of manual/external steps that are explicitly NOT
  automated by this skill (actual deploy command, smoke test execution,
  rollback plan) so the report is honest about what it did and didn't
  verify.
- Entirely read-only; never builds images, runs containers, or executes
  deployment commands.

## When to Use

- Before a first deployment of a new service, to catch missing env var
  documentation and Dockerfile anti-patterns early.
- As a pre-release gate check.
- Not a CI/CD pipeline replacement — see `ci-cd-pipeline-builder` (a
  separate skill in this harness) for generating actual pipeline configs,
  and `monitoring` for post-deploy observability setup.

## Example Invocations

```
/skill run deployment --scope .
/skill run deployment --scope . --skip-docker
```

## Expected Inputs

- `--scope` (path, required): project root to check.
- `--skip-docker` (flag, optional): skip Dockerfile checks even if one is
  present.

## Expected Outputs

JSON: `{ "envVars": { "referenced": string[], "undocumented": string[] }, "buildScript": boolean, "docker": { "present": boolean, "issues": string[] } | null, "checklist": string[] }`.

## Side Effects and Warnings

- Entirely read-only — does not build, push, run, or deploy anything.
- Env var detection is regex-based against `process.env.NAME` and
  `import.meta.env.NAME` patterns; dynamically constructed variable names
  (`process.env[someVar]`) will not be detected.
- The `checklist` field always includes manual steps this tool cannot
  verify (actual deploy execution, smoke tests, rollback readiness) —
  treat a clean report as "static preconditions look fine," not "safe to
  deploy with no further verification."
