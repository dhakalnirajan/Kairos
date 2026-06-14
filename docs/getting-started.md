# Getting Started

## Quick Start

```bash
# Install
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install

# Start TUI
bun run src/cli.ts

# Or headless mode
bun run src/cli.ts -p "Hello, what can you do?"
```

## First Steps

1. **Start the TUI**: `kairos`
2. **Configure provider**: `/mode NORMAL` or set API key
3. **Ask a question**: Type in the input box
4. **Use tools**: The agent will use tools when needed
5. **Try commands**: Type `/help` to see all 110+ commands

## Provider Setup

### Local (No API Key)

```bash
# Start llama.cpp
./llama-server -m models/llama-3-8b-instruct.gguf

# Or start Ollama
ollama serve
ollama pull llama3

# Auto-discover
kairos provider discover
```

### Cloud (API Key Required)

```bash
# OpenAI
export OPENAI_API_KEY=sk-...
kairos -p "hello" --provider openai

# Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
kairos -p "hello" --provider anthropic
```

## Example Session

```
You: Read the package.json file
Kairos: [Reads file using read_file tool]
The package.json shows this is a Bun project with...

You: Run the tests
Kairos: [Runs `bun test` using bash tool]
All 174 tests pass!

You: /help
Kairos: [Shows 110+ available commands]
```

## Learn More

- [Configuration](configuration.md)
- [Providers](providers.md)
- [Slash Commands](slash-commands.md)
- [Safety](safety.md)
