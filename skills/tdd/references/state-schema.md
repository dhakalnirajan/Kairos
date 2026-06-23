# .tdd-state.json Schema

Maintained at the project root by the `tdd` skill. One entry per target
source file.

```json
{
  "src/date.ts": {
    "status": "red",
    "testFile": "src/date.test.ts"
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `status` | `"red" \| "green" \| "broken"` | last known result of running the test for this target |
| `testFile` | string | path to the test file written for this target |

## Status Meanings

- **red** — test ran cleanly and failed on assertion. This is the expected
  state immediately after `tdd` writes a new test, before implementation.
- **green** — test ran and passed. Implementation satisfies the behavior;
  a new `--behavior` may now be started for this target.
- **broken** — the test itself could not run (import error, syntax error).
  This blocks starting a new cycle until fixed, since it means the harness
  cannot currently verify red or green for this target.

Safe to delete this file at any time; it will be regenerated empty. Deleting
it loses cycle-blocking history but does not affect the test files
themselves.
