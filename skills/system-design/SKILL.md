---
name: "system-design"
version: "1.0.0"
description: "Generates a Mermaid component/sequence diagram and a structured capacity-estimation worksheet from a described system, to support architecture discussions before implementation"
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

`system-design` produces two artifacts useful at the start of designing a
new system or service: a Mermaid diagram (component or sequence,
generated from a structured list of components and connections, not from
free-text description) and a capacity-estimation worksheet (a Markdown
table prompting for QPS, data size, growth rate, and the standard derived
numbers — storage over time, bandwidth, read/write ratio) with formulas
shown but values left as TODOs unless given via input. It complements
`design-md` (the narrative decision document) with the visual and
quantitative side of system design.

## Behavior Patterns

- `--diagram component` takes a list of `--node` entries (name, optional
  type) and `--edge` entries (`from->to` with optional label) and emits a
  valid Mermaid `graph TD` block.
- `--diagram sequence` takes a list of `--actor` entries and `--message`
  entries (`from->to: label`, in order) and emits a Mermaid
  `sequenceDiagram` block, preserving message order from input order.
- `--capacity` generates a Markdown worksheet with standard back-of-
  envelope sections (Traffic, Storage, Bandwidth, Caching) — if `--qps`,
  `--avg-item-size-kb`, or other known inputs are given, it computes
  daily/monthly derived figures inline; anything not given is left as an
  explicit `_(estimate)_` placeholder, never silently assumed.
- Validates that every `--edge`/`--message` references nodes/actors
  actually declared via `--node`/`--actor` — rejects dangling references
  rather than silently rendering a broken diagram.

## When to Use

- Sketching a system's component layout or request flow before writing
  `design-md`'s prose, or alongside it.
- Doing capacity estimation for a new service to sanity-check whether the
  proposed approach can plausibly handle expected load.
- Not a replacement for `design-md`'s tradeoff discussion — this skill
  produces diagrams and numbers, not the reasoning connecting them to a
  decision.

## Example Invocations

```
/skill run system-design --diagram component --node "API:service" --node "DB:database" --edge "API->DB:reads/writes" --output references/architecture.md
/skill run system-design --diagram sequence --actor Client --actor API --actor DB --message "Client->API: POST /upload" --message "API->DB: INSERT row"
/skill run system-design --capacity --qps 500 --avg-item-size-kb 200 --output references/capacity-estimate.md
```

## Expected Inputs

- `--diagram` (component|sequence, optional): which diagram type to
  generate.
- `--node` (string, repeatable, for `component`): `Name` or
  `Name:type`.
- `--edge` (string, repeatable, for `component`): `From->To` or
  `From->To:label`.
- `--actor` (string, repeatable, for `sequence`): actor name.
- `--message` (string, repeatable, for `sequence`): `From->To: label`,
  order-sensitive.
- `--capacity` (flag, optional): generate the capacity worksheet.
- `--qps`, `--avg-item-size-kb`, `--growth-rate-percent` (numbers,
  optional): known values to plug into the capacity worksheet.
- `--output` (path, optional): write result to file instead of stdout.
- Exactly one of `--diagram` or `--capacity` per invocation.

## Expected Outputs

A Markdown document containing a fenced ` ```mermaid ` block (for
`--diagram`) or a capacity worksheet table (for `--capacity`), printed to
stdout or written to `--output`.

## Side Effects and Warnings

- Only writes the output document itself, with `ask` permission, when
  `--output` is given — never touches source code.
- Diagram generation validates node/actor references but does not
  validate that the described architecture is sound — it's a rendering
  tool, not an architecture reviewer.
- Capacity worksheet formulas are standard back-of-envelope
  approximations (e.g. simple QPS × size × seconds-per-day), not a
  substitute for real load testing or a detailed capacity model for
  anything beyond rough sizing.
