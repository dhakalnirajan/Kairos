# Kairos Code

Terminal-native AI coding agent. Bun runtime, Blessed TUI, SQLite memory, multi-provider LLM.

## Quick Commands

```bash
bun install              # Install dependencies
bun run dev              # Hot-reload dev mode (TUI)
bun run build            # Bundle to dist/cli.js
bun run typecheck        # tsc --noEmit (ALWAYS run before committing)
bun test                 # Run tests
kairos setup             # First-run interactive wizard
kairos -p "query"        # Headless one-shot query
```

## Architecture

```
src/
  types/        Core types (ToolManifest, AgentMode, LLMConfig, etc.)
  config/       Zod schemas + hierarchical config loader
  llm/          Multi-provider LLM client (llamacpp, openai, ollama, anthropic)
  memory/       bun:sqlite 7-table DB with FTS5 search
  tools/        Tool registry + builtin tools (fs, shell, git, web, memory)
  security/     6-layer safety pipeline (runs on every tool call)
  agent/        ReAct loop + Compose 8-step pipeline
  tui/          Blessed split-pane layout, streaming, overlays, mascot
  cli/          Entry point, CLI parser, setup wizard
  daemon/       Background process, watchdog, cron
  hooks/        EventBus + user hook runner
  extensions/   Extension/skill loader (isolated Bun VM)
  mcp/          Model Context Protocol client
  utils/        Logger, paths, tokenizer
```

## Critical Constraints

- **Runtime**: Bun only. No Node.js APIs where Bun equivalents exist.
- **SQLite**: `import { Database } from "bun:sqlite"` — NEVER better-sqlite3 or node:sqlite.
- **Types**: Strict mode. No `any` types. `noUncheckedIndexedAccess` enabled.
- **TUI**: `@blessed/neo-blessed` with `tags: true` for color markup.
- **Config order**: CLI flags > env vars > project `.kairos/config.json` > global `~/.kairos/config.json` > defaults.
- **Safety**: All tool calls pass through 6-layer pipeline. HITL enforced for write/execute/network in NORMAL mode.
- **Paths**: Windows-compatible. Use `path` module, never hardcoded `/` or `\\`.

## Conventions

- All tool implementations go in `src/tools/builtin/`, register via `ToolRegistry`
- Zod schemas for everything (config, tool params, CLI args)
- LLM streaming via `AsyncGenerator<StreamEvent>`
- Config files use JSON (not YAML)
- Tests in `tests/` mirroring `src/` structure
- No comments in code unless explaining non-obvious logic
