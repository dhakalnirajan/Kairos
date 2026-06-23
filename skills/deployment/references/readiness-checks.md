# Deployment Readiness Checks

## Environment Variable Coverage

Source is scanned for `process.env.NAME` and `import.meta.env.NAME`
references (uppercase-with-underscores names only, matching standard env
var convention). Each referenced name is checked against keys defined in
`.env.example` at the project root. A variable referenced in code but
missing from `.env.example` means: someone deploying this project for the
first time has no way to know it needs to be set, short of reading every
source file.

**Deliberately checks `.env.example`, not `.env`.** `.env` files often
contain real secrets and are commonly gitignored; `.env.example` is the
conventional place to document *which* variables exist without their
values.

## Build Script Presence

Simple check: does `package.json`'s `scripts` object have a `build` key?
Does not verify the build script actually succeeds — pair with `testing`
or run the build manually before deploying.

## Dockerfile Sanity

Only runs if a `Dockerfile` exists at the project root (or skipped
entirely with `--skip-docker`). Three checks:

1. **Pinned base image** — `FROM node:latest` or `FROM node` (no tag) is
   flagged; `FROM node:20.11-slim` is not. Unpinned base images mean
   builds aren't reproducible and can silently change behavior between
   builds.
2. **Non-root USER** — containers running as root by default are a
   privilege-escalation risk if the container is ever compromised.
3. **`.dockerignore` presence** — without one, the build context can
   include `node_modules`, `.git`, `.env` files, or other content that
   bloats the image or leaks secrets into image layers.

## What This Skill Does Not Do

It does not run `docker build`, push images, execute deploy scripts, run
smoke tests, or verify actual secret values are provisioned in any target
environment. These appear in the `checklist` output field as explicit
manual next steps, not because automating them is impossible, but because
they involve real infrastructure side effects that are out of scope for a
static readiness check.
