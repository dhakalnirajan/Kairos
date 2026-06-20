# Kairos Code v0.1.0 Release Summary

## Release Date
2026-06-20

## Version
0.1.0

## What's Included

### Core Features
- **19 LLM Providers**: llama.cpp, Ollama, LM Studio, Text Gen WebUI, LocalAI, OpenAI, Anthropic, Gemini, Azure, Groq, Together, DeepSeek, Mistral, Perplexity, Fireworks, OpenRouter, xAI, Cohere, Replicate
- **210 Verified Features**: All tested and passing
- **86 Built-in Tools**: File operations, shell commands, web access, memory, security, and more
- **11 Agent Modes**: NORMAL, PLAN, ULTRAPLAN, AUTO, YOLO, SWARM, DAEMON, DREAM, UNDERCOVER, HEADLESS, VOICE

### Safety & Security
- 6-layer safety pipeline
- Audit logging with secret scrubbing
- Path confinement
- Harm detection
- HITL approval
- Network security

### Memory System
- SQLite with FTS5 full-text search
- Conversation history
- Topic facts with embeddings
- Workflow memory

### Extensibility
- MCP client for external tools
- Plugin system
- Skills framework
- Hook runner

### Documentation
- 18 markdown documentation files
- Vite+React web documentation site
- Comprehensive API reference

### Testing
- 66/66 tests passing
- 210 feature tests
- Typecheck clean

## Installation

```bash
# From source
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
bun run build

# Or download binary
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
```

## Quick Start

```bash
# Start TUI
bun run dist/cli.js

# Headless query
bun run dist/cli.js -p "Hello, what can you do?"

# Provider management
bun run dist/cli.js provider list
bun run dist/cli.js provider discover
bun run dist/cli.js provider test llamacpp
```

## What's Next (v0.2.0)

- Enhanced web documentation with shadcn/ui
- Additional edge case testing
- Performance optimization
- User guide with more examples

---

*Release prepared by Kairos QA System*
*QA Report: docs/qa-summary.md*
*Feature Spreadsheet: docs/feature-status.csv*
*Test Log: docs/test-results.log*
