# Providers

Kairos supports 20+ LLM providers, from local inference servers to cloud APIs.

## Provider Overview

| Provider | Type | Default Model | Setup |
|----------|------|---------------|-------|
| llama.cpp | Local | `local` | Server on `:8080` |
| Ollama | Local | `llama3` | Server on `:11434` |
| LM Studio | Local | `local` | Server on `:1234` |
| OpenAI | Cloud | `gpt-4o` | API key required |
| Anthropic | Cloud | `claude-sonnet-4-20250514` | API key required |
| Gemini | Cloud | `gemini-1.5-pro` | API key required |
| Groq | Cloud | `llama-3.3-70b-versatile` | API key required |
| DeepSeek | Cloud | `deepseek-chat` | API key required |
| Mistral | Cloud | `mistral-large-latest` | API key required |
| OpenRouter | Cloud | `anthropic/claude-3.5-sonnet` | API key required |

## Local Providers

### llama.cpp

```bash
# Start llama-server
./llama-server -m model.gguf --port 8080

# Configure Kairos
kairos setup
# Provider: llamacpp
# Base URL: http://localhost:8080
# Model: local
```

### Ollama

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3

# Configure Kairos
kairos setup
# Provider: ollama
# Base URL: http://localhost:11434
# Model: llama3
```

### LM Studio

```bash
# Download from https://lmstudio.ai
# Load a model in the app
# Server starts on http://localhost:1234

kairos setup
# Provider: lmstudio
# Base URL: http://localhost:1234/v1
# Model: local
```

## Cloud Providers

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
kairos setup
# Provider: openai
# Model: gpt-4o
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
kairos setup
# Provider: anthropic
# Model: claude-sonnet-4-20250514
```

### Groq

```bash
export GROQ_API_KEY=gsk_...
kairos setup
# Provider: groq
# Model: llama-3.3-70b-versatile
```

## Provider Commands

```bash
# List all providers and status
kairos provider list

# Discover local providers
kairos provider discover

# Test a provider connection
kairos provider test anthropic
```

## Fallback Chain

Kairos automatically falls back to other providers if the primary fails:

1. Configured provider
2. Other local providers (llama.cpp → Ollama → LM Studio)
3. Cloud providers with API keys

Set `fallbackEnabled: true` in config to enable.

## Provider Management

```bash
# Switch provider
kairos --provider ollama

# Or via slash command
/model llama3
```

## Next Steps

- [Configuration](configuration.md) — Provider-specific settings
- [CLI Flags](cli-flags.md) — Provider CLI options
