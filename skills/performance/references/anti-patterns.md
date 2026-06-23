# Anti-Pattern Reference

## N+1 Query

Detected when a query/fetch-like call (`query`, `find`, `findOne`,
`findAll`, `select`, `fetch`, `get`, case-insensitive) appears textually
within an open loop body (`for`, `forEach`, `.map(`, `while`), tracked via
brace-depth from the loop's opening line. This is the single most common
and highest-impact backend performance bug; flagging it cheaply, even with
false positives, is worth the noise.

**Common false positive:** a loop that calls a function which itself
contains "query" or "get" in its name but does no actual I/O (e.g.
`items.map(x => x.getId())`). Read the flagged line before assuming it's
real.

## Synchronous I/O in Handler

Detected when `readFileSync`, `writeFileSync`, `execSync`, or
`readdirSync` appears in a file whose path contains `route`, `handler`, or
`controller` (case-insensitive). Blocking calls in request-handling code
stall the event loop for every concurrent request, not just the one being
served.

**Common false positive:** one-time startup/config reads that happen to
live in a handler file but run once at module load, not per-request. Check
whether the call is inside the exported handler function or at module
scope.

## Unbounded Fetch

Detected when `.find()`, `.findAll()`, or `.select()` is called with no
arguments — no filter, no limit. Flags a possible unbounded result set.

**Common false positive:** ORMs where pagination is applied via a chained
method after the call (e.g. `.findAll().limit(50)`) rather than as an
argument — the limit exists, just not on the flagged line.

## Why Static-Only

`performance --scan` deliberately does not attempt dynamic profiling or
flamegraphs. For genuinely hard performance investigations, pair its
findings with `--measure` on a realistic workload, or a dedicated profiler
outside this harness.
