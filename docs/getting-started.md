# Getting Started

This guide walks you through your first session with Kairos.

## Prerequisites

- **Bun runtime** (v1.0+) — [Install Bun](https://bun.sh)
- **Git** — for version control features
- **An LLM provider** — local (llama.cpp, Ollama) or cloud (OpenAI, Anthropic, etc.)

## Step 1: Install

### From Binary (Recommended)

```bash
curl -fsSL https://github.com/dhakalnirajan/Kairos/releases/latest/download/kairos-linux-x64.tar.gz | tar -xz
chmod +x kairos && sudo mv kairos /usr/local/bin/
```

### From Source

```bash
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
```

## Step 2: Configure

Run the setup wizard:

```bash
kairos setup
```

This will prompt you for:
1. **Provider** — Choose from llamacpp, openai, anthropic, ollama, etc.
2. **Model** — The specific model to use
3. **Base URL** — For local providers, the server address
4. **API Key** — For cloud providers

### Quick Setup with Local LLM

If you have llama.cpp running:

```bash
kairos setup
# Provider: llamacpp
# Base URL: http://localhost:8080
# Model: local
```

### Quick Setup with Cloud LLM

```bash
export ANTHROPIC_API_KEY=sk-ant-...
kairos setup
# Provider: anthropic
# Model: claude-sonnet-4-20250514
```

## Step 3: Start

### TUI Mode (Default)

```bash
kairos
# or
bun run dev
```

### Headless Mode

```bash
kairos -p "What files are in the current directory?"
```

### Web Interface

```bash
kairos web
# Open http://localhost:3333 in your browser
```

### Plain REPL (No TUI)

```bash
kairos --no-tui
```

## Step 4: Your First Task

Once in the TUI, try:

```
> What is this project about?
> Read the README.md file
> List all TypeScript files
> Explain the safety pipeline
```

## Step 5: Learn the Commands

Type `/help` to see all available commands:

```
/help
```

Key commands to start with:
- `/status` — Show current system status
- `/model <name>` — Switch LLM model
- `/mode <mode>` — Switch agent mode (NORMAL, PLAN, AUTO, YOLO)
- `/review` — Review code for issues
- `/test` — Run tests

## Next Steps

- [Configuration](configuration.md) — Customize Kairos
- [Providers](providers.md) — Set up different LLM providers
- [Tools](tools.md) — Learn about available tools
- [Recipes](recipes.md) — Common workflows
