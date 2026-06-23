# Import Graph Construction

## Resolution Rules

Only relative imports (`./foo`, `../bar`) are resolved to graph edges.
For each relative import, the following candidates are tried in order:
the literal path, `path.ts`, `path.tsx`, `path.js`, `path.jsx`,
`path/index.ts`, `path/index.js`. The first candidate that exists within
`--scope` becomes the resolved edge. Bare specifiers (`react`, `lodash`)
and path aliases (`@/utils/foo`) are recorded as encountered but never
resolved to an edge, since resolving aliases would require reading
`tsconfig.json`/bundler config, which this tool intentionally does not do.

## Cycle Detection

Standard DFS with an on-stack set. When a back-edge to a node currently on
the stack is found, the cycle is the stack slice from that node's position
to the top, plus the closing edge back to it. Cycles are deduplicated by
comparing their node sets (ignoring rotation/starting point), so the same
cycle discovered from two different entry points is reported once.

## Unused Export Detection

An exported name is "used" if it appears in *any* file's
`import { name } from ...` destructured import list, anywhere in
`--scope`. This is a global cross-reference, not per-file — an export used
only by a sibling file still counts as used. Limitations:
- Default exports and namespace imports (`import * as foo`) are not
  tracked, so default-exported symbols will always show as unused — this
  is a known gap, not a real signal for default exports.
- An export consumed by code *outside* `--scope` (e.g. a published
  package's index re-exporting it for external consumers) will be
  incorrectly flagged.

## Hotspot Scoring

`fanIn + fanOut`, sorted descending. No normalization or percentile
calculation is applied — `--top N` is a literal top-N slice, not a
percentile threshold, despite earlier draft language suggesting otherwise.
Treat the raw counts as the signal.
