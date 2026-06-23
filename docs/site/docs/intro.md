---
title: Kairos Code
sidebar_position: 0
description: Terminal-native AI coding agent. Local-first, extensible, secure.
---

# Kairos Code

<div style={{textAlign: 'center', marginBottom: '2rem'}}>
  <img src="/Kairos/img/logo.png" alt="Kairos Code" style={{width: '120px', height: '120px'}} />
</div>

**Terminal-native AI coding agent. Local-first, extensible, secure.**

Kairos Code runs locally with your choice of LLM backend. It provides a full-featured TUI, web interface, headless CLI mode, and a daemon server — all powered by Bun runtime.

## Quick Start

```bash
# Install
bun install

# Start TUI
bun run dev

# Headless query
bun run src/cli.ts -p "Explain this function"

# Web interface
bun run src/cli.ts web
```

For detailed instructions, see [Getting Started](/docs/getting-started).

## Key Features

- **19 LLM providers** — llama.cpp, Ollama, OpenAI, Anthropic, Gemini, Groq, and more
- **82 built-in tools** — file operations, shell commands, web search, AST analysis, debugging
- **4-layer safety pipeline** — harm detection, risk classification, blueprint policy, HITL
- **Persistent memory** — SQLite-backed with FTS5 full-text search
- **27 skills** — TDD, code review, security, deployment, research, and more
- **Web search** — Brave API, Exa MCP, Mimo API, DuckDuckGo with auto-fallback
- **TUI** — split panes, streaming, command palette, themes
- **Web interface** — browser-based chat with streaming responses

## Documentation

| Section | Description |
|---------|-------------|
| [Getting Started](/docs/getting-started) | First-time setup and first session |
| [Configuration](/docs/user-guide/configuration) | Config files, environment variables, CLI flags |
| [Providers](/docs/user-guide/providers) | LLM provider setup and selection |
| [Tools](/docs/user-guide/tools) | 82 built-in tools reference |
| [Skills](/docs/user-guide/skills) | 27 skills for common workflows |
| [Safety](/docs/user-guide/safety) | Security pipeline and permissions |
| [Memory](/docs/user-guide/memory) | Persistent memory system |
| [TUI](/docs/user-guide/tui) | Terminal UI guide |
| [Slash Commands](/docs/user-guide/slash-commands) | ~111 slash commands |
| [API Reference](/docs/reference/api) | Programmatic API |
| [Changelog](/docs/changelog) | Version history |

## Community

- [GitHub](https://github.com/dhakalnirajan/Kairos) — Source code, issues, discussions
- [Issues](https://github.com/dhakalnirajan/Kairos/issues) — Bug reports and feature requests

## License

MIT License — see [LICENSE on GitHub](https://github.com/dhakalnirajan/Kairos/blob/main/LICENSE).
