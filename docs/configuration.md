# Configuration

Kairos uses a hierarchical configuration system. Settings are merged in this order:

1. **Defaults** — Built-in defaults
2. **Global config** — `~/.kairos/config.json` (or `AppData/Local/Kairos/config.json` on Windows)
3. **Project config** — `.kairos/config.json` in your workspace
4. **Environment variables** — Override specific values
5. **CLI flags** — Override everything

## Configuration File

The global config file is located at:
- **Linux/macOS**: `~/.kairos/config.json`
- **Windows**: `C:\Users\<username>\AppData\Local\Kairos\config.json`

### Example Config

```json
{
  "version": "0.1.1",
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "sk-ant-...",
    "maxTokens": 8192,
    "temperature": 0.7,
    "fallbackEnabled": true,
    "autoDiscoverLocal": true
  },
  "tools": {
    "enabled": ["read", "write", "edit", "bash", "glob", "grep"],
    "disabled": [],
    "confirmBeforeExecute": true,
    "maxConcurrent": 4
  },
  "safety": {
    "enabled": true,
    "allowedRiskLevels": ["read", "write", "execute"],
    "blockedCommands": ["rm -rf /", "format", "del /s /q"],
    "autoApprove": false,
    "requireConfirmationFor": ["bash", "write", "edit"]
  },
  "tui": {
    "theme": "default",
    "showTimestamps": true,
    "showTokenCount": true,
    "useColors": true
  },
  "memory": {
    "enabled": true,
    "persistToDisk": true,
    "ttlDays": 30
  },
  "daemon": {
    "enabled": false,
    "port": 7777,
    "maxWorkers": 4
  }
}
```

## Environment Variables

### LLM Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `KAIROS_LLM_PROVIDER` | LLM provider name | `anthropic` |
| `KAIROS_LLM_MODEL` | Model name | `claude-sonnet-4-20250514` |
| `KAIROS_LLM_BASE_URL` | Base URL for API | Provider-dependent |
| `KAIROS_LLM_API_KEY` | API key | — |
| `KAIROS_LLM_MAX_TOKENS` | Max tokens per response | `8192` |
| `KAIROS_LLM_TEMPERATURE` | Sampling temperature | `0.7` |

### Provider-Specific Keys

| Variable | Provider |
|----------|----------|
| `OPENAI_API_KEY` | OpenAI |
| `ANTHROPIC_API_KEY` | Anthropic |
| `GROQ_API_KEY` | Groq |
| `OPENROUTER_API_KEY` | OpenRouter |
| `GOOGLE_API_KEY` | Gemini |
| `DEEPSEEK_API_KEY` | DeepSeek |
| `MISTRAL_API_KEY` | Mistral |

### Safety & Daemon

| Variable | Description | Default |
|----------|-------------|---------|
| `KAIROS_SAFETY_ENABLED` | Enable safety pipeline | `true` |
| `KAIROS_SAFETY_AUTO_APPROVE` | Auto-approve all tools | `false` |
| `KAIROS_DAEMON_ENABLED` | Start daemon mode | `false` |
| `KAIROS_DAEMON_PORT` | Daemon HTTP port | `7777` |
| `AGENT_LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |

## Project-Level Config

Create `.kairos/config.json` in your project root to override settings per-project:

```bash
mkdir .kairos
echo '{"llm": {"model": "gpt-4o"}}' > .kairos/config.json
```

## CLI Flag Overrides

All config values can be overridden via CLI flags:

```bash
kairos --model gpt-4o --max-tokens 4096 --temperature 0.5
```

## Config Commands

```bash
# Show current config
kairos config show

# Set a value
kairos config set llm.model gpt-4o

# Reset to defaults
kairos config reset
```

## Next Steps

- [Providers](providers.md) — Configure LLM providers
- [Safety](safety.md) — Configure safety settings
