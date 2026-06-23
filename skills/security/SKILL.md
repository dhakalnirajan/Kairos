---
name: "security"
version: "1.0.0"
description: "Scans code for common vulnerability patterns (hardcoded secrets, SQL/command injection shapes, missing input validation on auth boundaries) and checks dependencies against known-vulnerable version ranges"
author: "harness-core"
category: "analysis"
tools:
  - read_file
  - bash
permissions:
  - allow: [read_file]
  - ask: [bash]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`security` runs two checks: a static source scan for vulnerability-shaped
code (string-concatenated SQL, `child_process.exec` with interpolated
input, hardcoded API keys/secrets matching common formats), and a
dependency check that reads the project's lockfile and flags packages
below known-patched versions for a small curated list of historically
significant CVEs. It does not run a full SAST engine or a live dependency
vulnerability database lookup — it's a fast, offline first pass meant to
catch the obvious and common cases before something more thorough runs in
CI.

## Behavior Patterns

- Secret detection uses format-shaped regexes (AWS access key ID pattern,
  generic `api[_-]?key\s*=\s*['"][A-Za-z0-9]{20,}`, private key PEM
  headers) rather than entropy analysis — fewer false positives, will miss
  secrets that don't match a known format.
- SQL injection detection flags string concatenation or template literals
  feeding directly into a `query(...)` call, distinguishing from
  parameterized calls (`query(sql, [params])`) which it does not flag.
- Command injection detection flags `exec`/`execSync`/`spawn` calls where
  the command string contains a template literal interpolation
  (`` `...${x}...` ``) rather than an argument array.
- Dependency check reads `package.json`/`package-lock.json` or
  `requirements.txt` and compares against a small bundled list in
  `references/known-vulnerable.json` — this list is illustrative and not a
  substitute for `npm audit` / `pip-audit` / a real vulnerability database.
- Every finding includes a severity (`critical`, `high`, `medium`) and
  never auto-redacts or modifies the flagged file.

## When to Use

- Before merging any change touching auth, payments, user input handling,
  or database queries.
- Periodically as a baseline sweep across an existing codebase.
- Not a replacement for `npm audit`, `pip-audit`, Snyk, or a real SAST
  tool in CI — use this as a fast local pre-check, those as the
  authoritative gate.

## Example Invocations

```
/skill run security --scan src/
/skill run security --scan src/db/queries.ts --deps-only
/skill run security --scan . --code-only
```

## Expected Inputs

- `--scan` (path, required): file or directory to scan.
- `--deps-only` (flag, optional): skip source scan, only check dependencies.
- `--code-only` (flag, optional): skip dependency check, only scan source.

## Expected Outputs

JSON: `{ "scanned": number, "findings": [{ "file": string, "line": number | null, "severity": "critical"|"high"|"medium", "category": "secret"|"sql-injection"|"command-injection"|"vulnerable-dependency", "message": string }] }`.

## Side Effects and Warnings

- Read-only against source; `bash` permission is only used to read
  lockfile contents if needed, never to execute project code.
- This is a pattern-matching scanner, not a real vulnerability database —
  `references/known-vulnerable.json` is a small illustrative list and will
  go stale. Always run `npm audit`/`pip-audit` as the authoritative
  dependency check; treat this skill's dependency findings as a reminder
  to do that, not as exhaustive.
- Secret detection will not catch secrets that don't match a known format,
  and can occasionally flag test fixtures or example keys — review findings
  before treating every hit as a live credential.
