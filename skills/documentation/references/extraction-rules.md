# Extraction Rules

## What Counts as an Export

Lines matching, after trimming: `export function`, `export class`,
`export const <name> =`, `export interface`, `export type <name> =`. Named
re-exports (`export { foo as bar }`) and `export default` are not
currently detected — add these manually to the compiled doc if needed.

## Signature Truncation

The signature shown is the export line up to (but not including) the first
`{`, so multi-line function bodies don't bloat the reference. Multi-line
*signatures* (parameters spanning several lines) will be truncated
mid-signature — this is a known limitation of the line-based regex
approach; for heavily multi-line signatures, reformat to single-line
before running, or accept the truncated output and edit it by hand.

## Doc Comment Matching

A doc comment is attached to an export only if a `/** ... */` block
appears on the lines immediately preceding it, with only blank lines
allowed in between. A regular `//` comment, or a `/** */` block separated
by a non-blank non-comment line, will not be picked up — this is
intentional, to avoid attaching an unrelated comment to the wrong export.

## Coverage Reporting

Stdout always contains the full Markdown document (or a "written to"
confirmation if `--output` was given). A separate one-line JSON summary
`{"documented": N, "total": M}` is printed to **stderr**, intended for
tooling that wants to gate on coverage percentage without parsing the
full Markdown body.
