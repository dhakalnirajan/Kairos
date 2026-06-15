# Kairos Code

**Terminal-native AI coding agent. Local-first, extensible, secure.**

[![Version](https://img.shields.io/badge/version-0.1.1-blue)](https://github.com/dhakalnirajan/Kairos/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Bun](https://img.shields.io/badge/runtime-Bun-black)](https://bun.sh)

---

## Quick Start

```bash
# Install
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
chmod +x kairos && sudo mv kairos /usr/local/bin/

# Or with Bun
bun install
bun run dev
```

## What is Kairos?

Kairos is a terminal-native AI coding agent that runs locally with your preferred LLM provider. It features:

- **Multi-Provider LLM Support** — 20+ providers including llama.cpp, Ollama, OpenAI, Anthropic, Gemini, Groq, and more
- **68 Built-in Tools** — File operations, shell commands, git, web search, AST analysis, debugging, and more
- **6-Layer Safety Pipeline** — Input sanitization, harm detection, risk classification, path confinement, URL blocking, HITL approval
- **Persistent Memory** — SQLite-backed FTS5 search with tiered storage (project/session/scratch/task)
- **TUI Interface** — Beautiful terminal UI with split panes, streaming, and command palette
- **Web Interface** — Browser-based chat with streaming responses
- **Daemon Mode** — Background HTTP server for programmatic access
- **68+ Slash Commands** — From `/review` to `/campaign` to `/vault`

## Installation

### Pre-built Binaries (Recommended)

```bash
# Linux x64
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
chmod +x kairos && sudo mv kairos /usr/local/bin/

# macOS (Intel)
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-darwin-x64.tar.gz | tar -xz
chmod +x kairos && sudo mv kairos /usr/local/bin/

# macOS (Apple Silicon)
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-darwin-arm64.tar.gz | tar -xz
chmod +x kairos && sudo mv kairos /usr/local/bin/

# Windows (PowerShell)
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-win-x64.zip -o kairos.zip
Expand-Archive kairos.zip -DestinationPath C:\Users\$env:USERNAME\AppData\Local\Microsoft\WinGet\Packages
```

### From Source

```bash
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
bun run dev
```

## Quick Usage

```bash
# Headless query
kairos -p "Explain this function"

# Interactive TUI
kairos

# Web interface
kairos web

# Setup wizard
kairos setup

# List providers
kairos provider list
```

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | First-time setup guide |
| [Installation](installation.md) | Detailed installation options |
| [Configuration](configuration.md) | Config files, environment variables |
| [Providers](providers.md) | LLM provider setup and selection |
| [CLI Flags](cli-flags.md) | Complete CLI reference |
| [Slash Commands](slash-commands.md) | All 68+ slash commands |
| [Safety](safety.md) | 6-layer safety pipeline |
| [Memory](memory.md) | Persistent memory system |
| [Tools](tools.md) | 68 built-in tools |
| [TUI](tui.md) | Terminal UI guide |
| [API Reference](api-reference.md) | Programmatic API |
| [Recipes](recipes.md) | Common workflows and recipes |
| [Contributing](contributing.md) | How to contribute |
| [Changelog](changelog.md) | Version history |

## Community

- [GitHub Issues](https://github.com/dhakalnirajan/Kairos/issues)
- [Discussions](https://github.com/dhakalnirajan/Kairos/discussions)

## License

MIT License — see [LICENSE](LICENSE) for details.
