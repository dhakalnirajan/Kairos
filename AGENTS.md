# Kairos Code

Terminal-native AI coding agent. Bun runtime, Blessed TUI, SQLite memory, multi-provider LLM.

## Quick Commands

```bash
bun install              # Install dependencies
bun run dev              # Hot-reload dev mode (TUI)
bun run build            # Bundle to dist/cli.js
bun run typecheck        # tsc --noEmit (ALWAYS run before committing)
bun test                 # Run all tests
bun run setup            # First-run interactive wizard
bun run -p "query"       # Headless one-shot query
bun run web              # Start web interface
```

**Verification order:** `bun run typecheck` → `bun test` → `bun run build`. CI runs all three.

## Engineering Skills

This project includes production-grade engineering skills in `skills/` directory:

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `tdd` | Test-driven development | Implementing logic, fixing bugs |
| `code-review` | Multi-axis code review | Before merging any change |
| `debugging` | Systematic root-cause debugging | When tests fail or behavior is unexpected |
| `security` | Security hardening | Handling user input, auth, external integrations |
| `performance` | Performance optimization | When performance requirements exist |

### Usage

Skills are activated automatically based on context, or can be invoked directly:
- Implementing code → `tdd` skill activates
- Reviewing code → `code-review` skill activates
- Something broken → `debugging` skill activates
- Security concerns → `security` skill activates
- Performance issues → `performance` skill activates

## Architecture

```
src/
  types/        Core types (ToolManifest, AgentMode, LLMConfig, etc.)
  config/       Zod schemas + hierarchical config loader
  llm/          Multi-provider LLM client (llamacpp, openai, ollama, anthropic, gemini, groq, etc.)
  memory/       bun:sqlite 7-table DB with FTS5 search
  tools/        Tool registry + 68 builtin tools
    builtin/    Individual tool implementations + index.ts (registration)
    registry.ts ToolRegistry class (register, execute, safety pipeline)
  security/     6-layer safety pipeline (runs on every tool call)
  agent/        ReAct loop + Compose 8-step pipeline + Swarm + Dream
  tui/          Blessed split-pane layout, streaming, overlays, mascot
  cli/          Entry point, CLI parser, setup wizard
  daemon/       Background process, watchdog, cron
  hooks/        EventBus + user hook runner
  extensions/   Extension/skill loader (isolated Bun VM)
  mcp/          Model Context Protocol client
  utils/        Logger, paths, tokenizer, shell detection
tests/          26 test files, ~66 tests total
```

**Entry point:** `src/cli.ts` → `src/cli/commands.ts` → branches to TUI/headless/web/daemon

## Adding a New Tool

1. Create `src/tools/builtin/my_tool.ts` exporting a `ToolInstance`:
   ```typescript
   export const myTool: ToolInstance = {
     name: 'my_tool',
     description: 'Does something useful',
     parameters: { type: 'object', properties: { action: { type: 'string' } }, required: ['action'] },
     riskLevel: 'read',  // 'read' | 'write' | 'execute' | 'network'
     isIdempotent: true,
     async execute(params, ctx) { return { success: true, output: 'done' }; }
   };
   ```
2. Register in `src/tools/builtin/index.ts` — add entry to `TOOL_LOADERS` array:
   ```typescript
   { name: "my_tool", loader: () => import("./my_tool.ts"), key: "myTool" },
   ```
3. Add tests in `tests/` matching `src/` structure.

## Critical Constraints

- **Runtime**: Bun only. No Node.js APIs where Bun equivalents exist.
- **SQLite**: `import { Database } from "bun:sqlite"` — NEVER better-sqlite3 or node:sqlite.
- **Types**: Strict mode. No `any` types. `noUncheckedIndexedAccess` enabled.
- **TUI**: `@blessed/neo-blessed` with `tags: true` for color markup. Style objects must be complete (fg, bg, bold, etc.).
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
- Import paths use `.ts` extensions (Bun bundler requires it)

## Testing

- `bun test` runs all 66 tests across 26 files
- Local model tests (`tests/local-models.test.ts`) skip when services unavailable — this is expected
- Run specific test: `bun test tests/safety.test.ts`
- Test a single tool: check `tests/tools.test.ts` or `tests/tools_extended.test.ts`

## CI Pipeline

- `.github/workflows/ci.yml`: typecheck → test → build (on push to main/develop)
- `.github/workflows/deploy-docs.yml`: build docs web → deploy to gh-pages
- `.github/workflows/release.yml`: release workflow

## Key Files

- `src/tools/builtin/index.ts` — Tool registration (TOOL_LOADERS array)
- `src/config/schema.ts` — Zod config schema
- `src/config/index.ts` — Config loader with env var and CLI flag overrides
- `src/security/pipeline.ts` — 6-layer safety pipeline
- `src/agent/loop.ts` — ReAct agent loop
- `src/tui/index.ts` — TUI slash command handlers
