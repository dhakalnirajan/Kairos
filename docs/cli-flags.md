# CLI Flags

## Usage

```bash
kairos [subcommand] [flags]
```

## Subcommands

| Command | Description |
|---------|-------------|
| `kairos` | Start TUI mode |
| `kairos setup` | First-run wizard |
| `kairos web` | Web interface |
| `kairos daemon` | Background daemon |
| `kairos provider` | Provider management |
| `kairos auth` | API key management |
| `kairos session` | Session management |

## Flags

| Flag | Description |
|------|-------------|
| `-p, --prompt <query>` | Run headless query |
| `--provider <name>` | Set LLM provider |
| `--model <name>` | Set model name |
| `--mode <mode>` | Set agent mode |
| `--theme <theme>` | Set TUI theme |
| `--port <port>` | Set web/daemon port |
| `-i, --interactive` | Interactive CLI mode |
| `--daemon` | Start as daemon |
| `--help` | Show help |
| `--version` | Show version |

## Modes

| Mode | Description |
|------|-------------|
| `NORMAL` | Default with HITL |
| `PLAN` | Read-only analysis |
| `AUTO` | Auto-approve safe tools |
| `YOLO` | Bypass all safety |
| `HEADLESS` | No TUI |
| `COMPOSE` | Autonomous pipeline |
| `SWARM` | Parallel execution |
| `DREAM` | Memory consolidation |
| `UNDERCOVER` | Strip AI fingerprints |

## Examples

```bash
# Headless query
kairos -p "Explain this code"

# Use specific provider
kairos -p "hello" --provider ollama --model llama3

# Start web interface
kairos web --port 8080

# List providers
kairos provider list

# Test provider
kairos provider test llamacpp
```

## Environment Variables

```bash
KAIROS_LLM_PROVIDER=ollama
KAIROS_LLM_MODEL=llama3
KAIROS_LLM_API_KEY=sk-...
KAIROS_SAFETY_ENABLED=true
KAIROS_DAEMON_PORT=7777
```
