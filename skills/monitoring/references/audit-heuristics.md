# Audit Heuristics and Scaffold Notes

## Silent Catch Detection

A `catch (e) { ... }` block is flagged `high` severity if its body
(brace-matched, not just the next line) contains no call to
`console.error`, `console.warn`, or any `logger.<method>(...)` that
references the caught variable by name. This catches both fully empty
catch blocks and catch blocks that do *something* (e.g. return a default
value) but never record that an error occurred — both are silent-failure
patterns from an operability standpoint, even though only the first is a
correctness bug.

**False positive case:** a catch block that re-throws (`throw e`) doesn't
log locally because the error will be logged wherever it's eventually
caught — re-throwing catches are still flagged since this script can't
trace where the re-thrown error ends up. Review re-throw cases manually.

## Unguarded Async Function Detection

Lower severity (`low`) than silent catches, since many codebases
deliberately rely on a single global unhandled-rejection handler rather
than per-function try/catch — this finding is a prompt to confirm that
pattern is intentional, not a default assumption of a bug.

## Scaffold Output

`--scaffold health` and `--scaffold metrics` produce framework-flavored
starting files, currently tuned for Express-style Node backends (matching
this project's default web/API stack). The metrics module is fully
in-memory and functional for local development, but has no real backend
wired up — every place a real APM/metrics system should be called is
marked with an explicit `// TODO: wire up to your APM/metrics backend`
comment rather than guessing a specific vendor integration.
