# KAIROS CODE

![Kairos Logo](/img/logo.png)

[![Deploy Documentation](https://github.com/dhakalnirajan/Kairos/actions/workflows/deploy-docs.yml/badge.svg)](https://github.com/dhakalnirajan/Kairos/actions/workflows/deploy-docs.yml)

[![Release](https://github.com/dhakalnirajan/Kairos/actions/workflows/release.yml/badge.svg)](https://github.com/dhakalnirajan/Kairos/actions/workflows/release.yml)

[![CI](https://github.com/dhakalnirajan/Kairos/actions/workflows/ci.yml/badge.svg)](https://github.com/dhakalnirajan/Kairos/actions/workflows/ci.yml)

> Terminal-native AI coding agent. Local-first, extensible, secure.

**Version:** 0.1.1

## What is Kairos Code?

Kairos Code is a terminal-native AI coding agent that runs locally with your choice of LLM backend. It provides a full-featured TUI (Terminal User Interface), web interface, headless CLI mode, and a daemon server — all powered by Bun runtime.

**Key features:**
- **19 LLM providers** with auto-discovery (llama.cpp, Ollama, LM Studio, OpenAI, Anthropic, Gemini, and more)
- **82 built-in tools** for file operations, shell commands, web access, memory, security, and more
- Interactive TUI with split panes, streaming, command palette
- Web interface for browser/SSH tunnel access
- 4-layer safety pipeline for all tool calls
- KAIROS.md agentic instructions (like CLAUDE.md)
- Swarm mode for parallel task execution
- MCP (Model Context Protocol) support
- Extension system with isolated execution

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- [llama.cpp](https://github.com/ggerganov/llama.cpp) (optional, for local models)
- [Ollama](https://ollama.ai) (optional, for local models)
- Git

### Install

```bash
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
```

### First Run

```bash
# Interactive setup wizard
bun run src/cli.ts setup

# Or start directly with headless mode
bun run src/cli.ts -p "Hello, what can you do?"

# Start the TUI
bun run src/cli.ts

# Start web interface
bun run src/cli.ts web --port 3333
```

## Usage

### CLI Modes

```bash
# Headless one-shot query
kairos -p "Explain this code"

# Interactive TUI
kairos

# Web interface (browser)
kairos web

# Custom port
kairos web --port 8080

# SSH tunnel access
ssh -L 3333:localhost:3333 remote-host
# Then open http://localhost:3333
```

### Provider Management

```bash
# List all providers and their status
kairos provider list

# Auto-discover local providers
kairos provider discover

# Test a specific provider connection
kairos provider test llamacpp
kairos provider test ollama
kairos provider test openai
```

### Configuration

Kairos uses a hierarchical config system:

1. CLI flags (highest priority)
2. Environment variables (`KAIROS_LLM_PROVIDER`, `KAIROS_LLM_MODEL`, etc.)
3. Project config (`.kairos/config.json`)
4. Global config (`~/.kairos/config.json`)
5. Defaults (lowest priority)

```bash
# View current config
kairos config show

# Set a value
kairos config set llm.model llama3

# Reset to defaults
kairos config reset
```

### LLM Providers

#### Local Providers (Auto-Discovery)

| Provider | Default URL | Notes |
|----------|-------------|-------|
| llama.cpp | `http://localhost:8080` | Auto-detects legacy/modern API |
| Ollama | `http://localhost:11434` | Dynamic model listing |
| LM Studio | `http://localhost:1234/v1` | OpenAI-compatible |
| Text Gen WebUI | `http://localhost:5000/v1` | Oobabooga |
| LocalAI | `http://localhost:8080/v1` | Multi-model support |

#### Cloud Providers

| Provider | Default URL | Notes |
|----------|-------------|-------|
| OpenAI | `https://api.openai.com/v1` | GPT-4o, GPT-4-turbo |
| Anthropic | `https://api.anthropic.com/v1` | Claude 3.5 Sonnet |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | Gemini 1.5 Pro |
| Azure OpenAI | Custom endpoint | Azure AD auth support |
| Groq | `https://api.groq.com/openai/v1` | Fast inference |
| Together AI | `https://api.together.xyz/v1` | Open-source models |
| DeepSeek | `https://api.deepseek.com/v1` | Reasoning models |
| Mistral AI | `https://api.mistral.ai/v1` | Codestral |
| Perplexity | `https://api.perplexity.ai` | Search-integrated |
| Fireworks | `https://api.fireworks.ai/inference/v1` | Fine-tuned models |
| OpenRouter | `https://openrouter.ai/api/v1` | Universal gateway |
| xAI | `https://api.x.ai/v1` | Grok models |
| Cohere | `https://api.cohere.ai/v2` | Native API support |
| Replicate | `https://api.replicate.com/v1` | Async inference |

```bash
# Use llama.cpp
kairos -p "hello" --provider llamacpp --model <Model_Name>

# Use Ollama
kairos -p "hello" --provider ollama --model llama3

# Use OpenAI
OPENAI_API_KEY=sk-... kairos -p "hello" --provider openai

# Use Anthropic
ANTHROPIC_API_KEY=sk-ant-... kairos -p "hello" --provider anthropic

# Auto-discover and use best local provider
kairos -p "hello" --provider auto
```

## Tools

| Tool | Risk | Description |
|------|------|-------------|
| `read_file` | read | Read file contents |
| `write_file` | write | Write/create files |
| `edit_file` | write | Edit files with exact match |
| `bash` | execute | Run shell commands |
| `git` | read/write | Git operations |
| `glob` | read | Find files by pattern |
| `grep` | read | Search file contents |
| `http_fetch` | network | Fetch web content |
| `web_search` | network | Search the web (Brave API / DuckDuckGo fallback) + fetch & extract |
| `memory_ops` | read/write | Persistent memory |

## Agent Modes

| Mode | Description |
|------|-------------|
| NORMAL | Default mode with HITL for risky tools |
| PLAN | Read-only analysis and planning |
| ULTRAPLAN | Extended planning with deeper analysis |
| AUTO | Auto-approve safe tools |
| YOLO | Bypass all safety checks |
| HEADLESS | No TUI, stdout/stderr only |
| SWARM | Parallel task execution |
| DAEMON | Background process mode |
| DREAM | Memory consolidation |
| UNDERCOVER | Strip AI fingerprints |
| VOICE | Voice interaction mode |

## KAIROS.md

Create a `KAIROS.md` file in your project root to customize agent behavior:

```markdown
# KAIROS.md

You are Kairos, a terminal-native AI coding agent.

## Rules
- Always read before editing
- Run tests after changes
- Be concise
```

The agent reads this file automatically and uses it as the system prompt.

## Slash Commands (TUI)

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear chat |
| `/model <name>` | Switch model |
| `/mode <mode>` | Switch agent mode |
| `/dream` | Consolidate memory |
| `/compact` | Summarize context |
| `/undo` | Revert last turn |
| `/sessions` | List sessions |
| `/export` | Export session |
| `/quit` | Exit |

## Local Model Setup

### llama.cpp

```bash
# Start llama.cpp server
./llama-server -m models/llama-3-8b-instruct.gguf

# Or with custom port
./llama-server -m models/llama-3-8b-instruct.gguf --port 8080

# Test connection
kairos provider test llamacpp
```

### Ollama

```bash
# Install and start Ollama
ollama serve

# Pull a model
ollama pull llama3

# List available models
ollama list

# Test connection
kairos provider test ollama
```

### LM Studio

1. Download LM Studio
2. Load a model
3. Start the local server (default port 1234)
4. Test connection: `kairos provider test lmstudio`

## Architecture

```
src/
  types/        Core type definitions
  config/       Zod schemas + hierarchical config loader
  llm/          Multi-provider LLM client with auto-discovery
  memory/       bun:sqlite with FTS5 full-text search
  tools/        Tool registry + builtin tools
  security/     Safety pipeline (harm-detection, risk-classification, blueprint-policy, HITL)
  agent/        ReAct loop + Compose + Swarm + Dream + Undercover
  tui/          Terminal UI (Blessed widgets)
  cli/          CLI entry point + recursive descent parser
  daemon/       Background HTTP server with worker pool
  hooks/        EventBus + hook runner
  extensions/   Extension loader with Bun VM isolation
  skills/       Skill runner (27 skills including web-search)
  sdlc/         SDLC commands
  mcp/          Model Context Protocol client
  web/          Web interface server
  utils/        Logger, paths, path security, tokenizer, shell detection
tests/          Test suite (bun:test)
```

## Development

```bash
# Install dependencies
bun install

# Run in dev mode
bun run dev

# Type check
bun run typecheck

# Run tests
bun test

# Build for production
bun run build

# Run built CLI
bun run dist/cli.js -p "hello"
```

## Security

All tool calls pass through a safety pipeline:

1. **Input Sanitization** - Strip control characters, null bytes
2. **Harm Detection** - Block destructive commands and dangerous intent
3. **Risk Classification** - Categorize as read/write/execute/network
4. **Blueprint Policy** - Path confinement and network protection (block private IPs, DNS rebinding)
5. **HITL Gate** - Require confirmation for risky operations

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KAIROS_LLM_PROVIDER` | Default LLM provider |
| `KAIROS_LLM_MODEL` | Default model name |
| `KAIROS_LLM_BASE_URL` | Custom API endpoint |
| `KAIROS_LLM_API_KEY` | API key |
| `KAIROS_LLM_MAX_TOKENS` | Max tokens per response |
| `KAIROS_LLM_TEMPERATURE` | Temperature (0-2) |
| `KAIROS_SAFETY_ENABLED` | Enable safety pipeline |
| `KAIROS_DAEMON_PORT` | Daemon port |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `BRAVE_API_KEY` | Brave Search API key (enables Brave as primary search backend) |
| `GROQ_API_KEY` | Groq API key |
| `TOGETHER_API_KEY` | Together AI key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `MISTRAL_API_KEY` | Mistral AI key |
| `COHERE_API_KEY` | Cohere API key |
| `REPLICATE_API_TOKEN` | Replicate API token |

## License

MIT
