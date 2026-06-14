# Configuration

## Config File Locations

1. CLI flags (highest priority)
2. Environment variables
3. Project config (`.kairos/config.json`)
4. Global config (`~/.kairos/config.json`)
5. Defaults (lowest priority)

## Config Structure

```json
{
  "version": "0.1.0",
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "",
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
    "blockedCommands": ["rm -rf /", "format"],
    "requireConfirmationFor": ["bash", "write", "edit"],
    "autoApprove": false
  },
  "tui": {
    "theme": "default",
    "showTimestamps": true,
    "showTokenCount": true,
    "compactMode": false
  },
  "memory": {
    "enabled": true,
    "persistToDisk": true,
    "maxSessionSize": 1048576,
    "ttlDays": 30
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `KAIROS_LLM_PROVIDER` | Default provider |
| `KAIROS_LLM_MODEL` | Default model |
| `KAIROS_LLM_API_KEY` | API key |
| `KAIROS_SAFETY_ENABLED` | Enable safety |
| `KAIROS_DAEMON_PORT` | Daemon port |

## Config Commands

```bash
# View config
cat ~/.kairos/config.json

# Reset to defaults
kairos config reset
```
