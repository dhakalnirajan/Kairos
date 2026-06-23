# Design Document Section Guide

| Section | Purpose | Who fills it |
|---|---|---|
| Problem | What's broken or missing, and why it matters now | author, via `--problem` |
| Goals | Concrete success criteria | reviewer fills in after generation |
| Non-Goals | Explicitly excluded scope, to prevent scope creep later | reviewer fills in after generation |
| Proposed Approach | The chosen solution | author, via `--approach` |
| Alternatives Considered | Other options and why they were rejected | author, via `--alt` (repeatable) |
| Tradeoffs | What the chosen approach gives up | reviewer fills in after generation |
| Open Questions | Unresolved items before implementation | reviewer fills in after generation |

## Why Alternatives Are Enforced (as a Warning)

A design document that only describes the chosen approach with no
alternatives is indistinguishable from a document written to justify a
decision already made for unstated reasons. `design-md` doesn't block
generation without `--alt`, but it inserts a visible `**INCOMPLETE**`
marker so the gap can't be silently missed in review.

## Relationship to `plan`

`design-md` is for deciding *what* to build and *why this approach*.
`plan` is for sequencing *how* to build something once the approach is
settled. Use `design-md` first for genuinely undecided problems, then
`plan` once `design-md`'s output is approved.
