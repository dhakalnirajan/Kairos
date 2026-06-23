---
name: "design-md"
version: "1.0.0"
description: "Produces a structured design document (problem, approach, alternatives considered, tradeoffs) in Markdown from a feature description, before implementation begins"
author: "harness-core"
category: "documentation"
tools:
  - read_file
  - write_file
permissions:
  - allow: [read_file]
  - ask: [write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`design-md` produces the written artifact that should exist before a
nontrivial feature is built: a design document covering the problem being
solved, the chosen approach, at least one alternative that was considered
and rejected (with why), and explicit tradeoffs. This is distinct from
`plan`, which produces an execution checklist against an already-decided
approach — `design-md` is for when the approach itself is still up for
discussion and needs to be written down and reviewed first.

## Behavior Patterns

- Requires both a problem statement and at least one proposed approach;
  refuses to fabricate a design from a problem statement alone, since that
  would mean inventing the actual decision rather than documenting one.
- Always includes an "Alternatives Considered" section. If only one
  approach is given via `--approach`, prompts (in the output, as an
  explicit TODO marker) for at least one alternative rather than silently
  omitting the section — a design doc with no alternatives considered is a
  red flag worth surfacing, not hiding.
- Structures output with stable section headers (`Problem`, `Goals`,
  `Non-Goals`, `Proposed Approach`, `Alternatives Considered`, `Tradeoffs`,
  `Open Questions`) so downstream tooling or reviewers know what to expect
  regardless of content.
- Writes only the design document; never touches source code.

## When to Use

- Before starting any feature where the implementation approach isn't
  obvious or uncontested — new subsystems, anything with multiple viable
  architectures, anything crossing team/service boundaries.
- Not needed for small, obvious changes where the approach genuinely has
  no alternatives worth documenting.

## Example Invocations

```
/skill run design-md --problem "Need to rate limit uploads per user" --approach "Token bucket in Redis, checked in middleware" --output references/upload-rate-limit-design.md
/skill run design-md --problem "Sync state between two services" --approach "Event-driven via message queue" --alt "Polling on a fixed interval"
```

## Expected Inputs

- `--problem` (string, required): what problem is being solved and why.
- `--approach` (string, required): the proposed solution.
- `--alt` (string, repeatable, optional): an alternative considered and
  (implicitly) rejected in favor of `--approach`.
- `--output` (path, optional): where to write the document; defaults to
  stdout.

## Expected Outputs

A Markdown document with the fixed section structure described above,
either printed to stdout or written to `--output`.

## Side Effects and Warnings

- Only writes the design document itself, with `ask` permission — never
  touches source code.
- If no `--alt` is given, the output explicitly flags the missing
  alternatives section as incomplete rather than silently producing a
  one-sided document — treat that flag as a prompt to go back and think
  about what else was considered.
- This tool documents a decision; it does not make one. The actual
  approach selection is a human or upstream-agent judgment call.
