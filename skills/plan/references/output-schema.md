# Plan Output Schema

The `plan` skill emits Markdown with a fixed section order so downstream
tooling can parse it reliably with a simple heading split.

| Section | Required | Notes |
|---|---|---|
| `# Implementation Plan` | yes | top-level title, always present |
| `## Summary` | yes | echoes `--task` verbatim |
| `## Affected Files (candidates)` | yes | bullet list of relative paths, may say "no files matched" |
| `## Steps` | yes | numbered list, ordered |
| `## Risks` | yes | at least one line, even if "no risks detected" |
| `## Open Questions` | yes | placeholder line if none found automatically |
| `## Suggested Follow-up Skills` | yes | bullet list referencing other skill names |

## Risk Keyword List

Risk flagging is keyword-based, not semantic. Current list (also in
`config/defaults.yaml`): `auth`, `payment`, `billing`, `migration`,
`schema`, `delete`. Extend this list in config rather than editing the
script when new sensitive areas are identified for a given codebase.

## Known Limitations

- File discovery is keyword-matching against file paths, not file content
  or AST analysis. It will miss files that are relevant but don't share
  vocabulary with the task description.
- `--depth deep` walks up to 8 directory levels and can be slow on large
  monorepos; prefer narrowing `--scope` first.
