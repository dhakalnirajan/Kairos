# Normalized Test Result Schema

```json
{
  "framework": "vitest",
  "passed": 12,
  "failed": 1,
  "skipped": 0,
  "failures": [
    { "name": "user.test.ts > getUser returns id", "message": "see full output for stack trace" }
  ],
  "coverage": { "lines": 87.5, "branches": 72.1 }
}
```

`coverage` is `null` when `--coverage` was not passed, or when the runner's
output didn't match a known coverage summary format.

## Parsing Notes

Result parsing is regex-based against each framework's default text
reporter output, not a structured JSON reporter. This keeps `testing`
dependency-free, but means:

- Custom reporters that change output formatting will produce `passed: 0,
  failed: 0` (a parse miss), not a crash. Always check `failures.length`
  against expectations if numbers look suspiciously low.
- pytest coverage parsing expects `pytest-cov`'s default `TOTAL` summary
  line; other coverage plugins may not match.

If a project relies on heavily customized reporter output, consider running
the underlying test command directly and treating `testing`'s normalized
summary as a best-effort cross-check rather than the source of truth.
