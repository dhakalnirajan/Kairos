# Orchestration Model

## Why Implementation Is Not Automated

`sdlc` deliberately stops after the `plan` stage and resumes only at
`--verify`, with the actual writing of code happening outside its
control entirely. This is intentional: automatically chaining
`plan → code-generation → testing` would mean a single `sdlc` invocation
could write and "verify" code with no human or upstream-agent checkpoint
in between. Keeping that gap explicit means a plan can be reviewed before
anything gets written.

## Stage Invocation

Each stage is invoked as a subprocess running that skill's
`scripts/run.ts` directly — `sdlc` does not duplicate any skill's logic,
it only shells out and parses the JSON each one prints to stdout. JSON
parsing looks for the *last* `{...}` block in stdout specifically to
tolerate skills that print log lines before their final JSON result.

## Readiness Computation

```
ready = testing.failed == 0
     && no code-review comment has severity "blocking"
     && no security finding has severity "critical"
```

This is a coarse AND across three independent signals. A `ready: false`
result doesn't indicate *which* stage failed without reading
`stages.*` — always inspect the per-stage output, since "not ready" could
mean one failing test or one critical secret leak, and those need very
different responses.

## Resolving Sibling Skill Paths

`--skills-dir` defaults to `..`, assuming `sdlc`'s own `scripts/run.ts` is
invoked from within `skills/sdlc/`, making `../plan`, `../testing`, etc.
resolve correctly relative to the `skills/` root. If the harness installs
skills under a different layout, pass `--skills-dir` pointing at the
actual `skills/` root explicitly.

## Runner Override

Set the `SDLC_RUNNER` environment variable to `node` to invoke sibling
skills via `node --experimental-strip-types` instead of `bun`, useful in
environments without Bun installed (matching this skill's own test
harness convention).
