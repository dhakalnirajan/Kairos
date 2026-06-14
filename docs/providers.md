# LLM Providers

Kairos supports 19 LLM providers with auto-discovery and fallback.

## Local Providers

| Provider | Default URL | Notes |
|----------|-------------|-------|
| llama.cpp | `http://localhost:8080` | Auto-detects legacy/modern API |
| Ollama | `http://localhost:11434` | Dynamic model listing |
| LM Studio | `http://localhost:1234/v1` | OpenAI-compatible |
| Text Gen WebUI | `http://localhost:5000/v1` | Oobabooga |
| LocalAI | `http://localhost:8080/v1` | Multi-model support |

## Cloud Providers

| Provider | Default URL | Env Key |
|----------|-------------|---------|
| OpenAI | `https://api.openai.com/v1` | `OPENAI_API_KEY` |
| Anthropic | `https://api.anthropic.com/v1` | `ANTHROPIC_API_KEY` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta` | `GOOGLE_API_KEY` |
| Azure OpenAI | Custom endpoint | `AZURE_OPENAI_API_KEY` |
| Groq | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` |
| Together AI | `https://api.together.xyz/v1` | `TOGETHER_API_KEY` |
| DeepSeek | `https://api.deepseek.com/v1` | `DEEPSEEK_API_KEY` |
| Mistral AI | `https://api.mistral.ai/v1` | `MISTRAL_API_KEY` |
| Perplexity | `https://api.perplexity.ai` | `PERPLEXITY_API_KEY` |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `FIREWORKS_API_KEY` |
| OpenRouter | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` |
| xAI | `https://api.x.ai/v1` | `XAI_API_KEY` |
| Cohere | `https://api.cohere.ai/v2` | `COHERE_API_KEY` |
| Replicate | `https://api.replicate.com/v1` | `REPLICATE_API_TOKEN` |

## Provider Commands

```bash
kairos provider list           # List all providers
kairos provider discover       # Auto-discover local providers
kairos provider test <name>    # Test provider connection
```

## Configuration

```bash
# Set provider via environment
export KAIROS_LLM_PROVIDER=ollama
export KAIROS_LLM_MODEL=llama3

# Or via CLI flags
kairos -p "hello" --provider ollama --model llama3
```
