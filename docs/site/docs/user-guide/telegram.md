---
title: Telegram
sidebar_position: 3
description: Connect Kairos Code to Telegram for messaging access from any device.
---

# Telegram Integration

Kairos Code can run as a Telegram bot, letting you chat with your AI coding agent from any device — phone, desktop, or web. The integration supports text messages, streaming responses, group chats, and webhook mode for cloud deployments.

## Quick Start

### 1. Create a Bot via BotFather

1. Open Telegram and search for **@BotFather** (or visit [t.me/BotFather](https://t.me/BotFather))
2. Send `/newbot`
3. Choose a display name (e.g., "Kairos Code")
4. Choose a username ending in `bot` (e.g., `kairos_code_bot`)
5. BotFather replies with your **API token** — keep it secret

### 2. Set the Token

```bash
export TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
```

Or add to `.env`:
```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
```

### 3. Start the Bot

```bash
bun run src/cli.ts telegram
```

The bot comes online within seconds. Send it a message on Telegram to verify.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot API token from BotFather |
| `TELEGRAM_ALLOWED_USERS` | No | Comma-separated user IDs to authorize |
| `TELEGRAM_ALLOWED_CHATS` | No | Comma-separated chat IDs to allow |
| `TELEGRAM_WEBHOOK_URL` | No | Public HTTPS URL for webhook mode |
| `TELEGRAM_WEBHOOK_SECRET` | No | Secret token for webhook verification |
| `TELEGRAM_HOME_CHANNEL` | No | Chat ID for scheduled task deliveries |

### Config File

Add to `~/.kairos/config.json`:

```json
{
  "telegram": {
    "enabled": true,
    "token": "your-bot-token",
    "allowedUserIds": [123456789],
    "allowedChats": [-1001234567890],
    "requireMention": true,
    "mentionPatterns": ["^kairos\\b"],
    "streaming": true,
    "webhookUrl": "https://your-domain.com",
    "webhookSecret": "your-secret",
    "webhookPort": 8443,
    "homeChannel": -1001234567890
  }
}
```

### Finding Your User ID

Your Telegram user ID is a number (not your username). Message [@userinfobot](https://t.me/userinfobot) to get it.

## Commands

The Telegram bot has full access to all CLI commands:

### General
| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all available commands |
| `/status` | Show mode, message count, active sessions |
| `/version` | Show version, provider, model, tool/skill counts |
| `/health` | System health check (LLM connection, safety, memory) |

### Conversation
| Command | Description |
|---------|-------------|
| `/new` | Start a new session |
| `/clear` | Clear conversation history |
| `/undo` | Undo last turn (not yet supported) |
| `/compact` | Compact context (not yet supported) |
| `/dream` | Consolidate memory (not yet supported) |

### Mode & Model
| Command | Description |
|---------|-------------|
| `/mode` | Show current mode and available modes |
| `/mode <name>` | Switch mode (NORMAL/PLAN/ULTRAPLAN/AUTO/YOLO/HEADLESS/SWARM/DREAM/UNDERCOVER) |
| `/model` | Show current model |
| `/model <name>` | Switch model |

### Provider Management
| Command | Description |
|---------|-------------|
| `/provider list` | List all local and cloud providers with status |
| `/provider discover` | Auto-discover local providers (llama.cpp, Ollama) |
| `/provider test <name>` | Test provider connection |

### Session Management
| Command | Description |
|---------|-------------|
| `/session list` | List past sessions with titles and timestamps |

### Memory
| Command | Description |
|---------|-------------|
| `/memory search <query>` | Search memory for facts matching query |
| `/memory store <topic>: <fact>` | Store a fact in memory |
| `/memory facts` | List all stored facts |
| `/memory facts <topic>` | List facts for a specific topic |

### Skills
| Command | Description |
|---------|-------------|
| `/skill list` | List all 27 available skills |
| `/skill search <query>` | Search skills by name or description |
| `/skill run <name>` | Run a skill with optional `--key value` args |

### Tools
| Command | Description |
|---------|-------------|
| `/tool list` | List all 82 available tools with risk levels |
| `/tool run <name>` | Execute a tool with JSON parameters |

### Configuration
| Command | Description |
|---------|-------------|
| `/config show` | Show current configuration |
| `/config set <key> <value>` | Set a config value |
| `/config reset` | Reset to defaults (not yet supported) |

## Streaming

When streaming is enabled (default), the bot progressively updates the message as the agent generates tokens — you see responses appear word by word rather than waiting for the full response.

```json
{ "telegram": { "streaming": true } }
```

Disable for final-response-only mode:
```json
{ "telegram": { "streaming": false } }
```

## Group Chat Support

### Privacy Mode

Telegram bots have privacy mode enabled by default. To use the bot in groups:

1. Message **@BotFather** → `/mybots` → select your bot
2. Go to **Bot Settings → Group Privacy → Turn off**
3. **Remove and re-add** the bot to any existing groups

### Mention Detection

With `requireMention: true`, the bot only responds in groups when:
- The message starts with a `/command`
- The bot is replied to directly
- `@botusername` is mentioned
- A configured mention pattern matches

```json
{
  "telegram": {
    "requireMention": true,
    "mentionPatterns": ["^kairos\\b", "^hey bot\\b"]
  }
}
```

## Webhook Mode

For cloud deployments (Fly.io, Railway, Render), webhook mode is more cost-effective. Telegram pushes updates to your bot instead of polling.

### Setup

```bash
export TELEGRAM_WEBHOOK_URL=https://your-app.fly.dev
export TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Or in config:
```json
{
  "telegram": {
    "webhookUrl": "https://your-app.fly.dev",
    "webhookSecret": "your-generated-secret",
    "webhookPort": 8443
  }
}
```

### Cloud Deployment (Fly.io)

```bash
fly secrets set TELEGRAM_WEBHOOK_URL=https://my-app.fly.dev
fly secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
```

Expose the webhook port in `fly.toml`:
```toml
[[services]]
  internal_port = 8443
  protocol = "tcp"
  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### Polling vs Webhook

| Feature | Polling (default) | Webhook |
|---------|-------------------|---------|
| Direction | Bot → Telegram (outbound) | Telegram → Bot (inbound) |
| Best for | Local, always-on servers | Cloud platforms with auto-wake |
| Setup | No extra config | Set `TELEGRAM_WEBHOOK_URL` |
| Idle cost | Machine must stay running | Machine can sleep between messages |

## Authorization

### User Restrictions

By default, anyone can interact with the bot. Restrict to specific users:

```bash
export TELEGRAM_ALLOWED_USERS=123456789,987654321
```

Or in config:
```json
{ "telegram": { "allowedUserIds": [123456789, 987654321] } }
```

### Chat Restrictions

Restrict to specific group chats:
```json
{ "telegram": { "allowedChats": [-1001234567890] } }
```

## Proxy Support

If Telegram's API is blocked, set a proxy:
```json
{ "telegram": { "proxyUrl": "socks5://127.0.0.1:1080" } }
```

Or environment variable:
```bash
export TELEGRAM_PROXY=socks5://127.0.0.1:1080
```

## How It Works

1. **Long Polling**: Bot fetches updates from Telegram every 30 seconds
2. **Message Processing**: Text messages are routed to the Kairos agent loop
3. **Streaming**: Agent tokens are progressively sent via `editMessageText`
4. **Session Isolation**: Each chat (and thread) gets its own agent session
5. **Tool Execution**: Agent can use all 82 built-in tools during conversation

### Architecture

```
Telegram User → Telegram API → Kairos Telegram Bot → AgentLoop → LLM + Tools
                                       ↓
                               editMessageText (streaming)
                                       ↓
                              Telegram User sees response
```

## Troubleshooting

### Bot doesn't respond in groups
1. Disable privacy mode in BotFather
2. Remove and re-add the bot to the group
3. Set `requireMention: false` or mention the bot

### Bot doesn't respond at all
1. Check `TELEGRAM_BOT_TOKEN` is set
2. Verify token with `curl https://api.telegram.org/bot<TOKEN>/getMe`
3. Check for firewall blocking `api.telegram.org`

### Streaming not working
1. Ensure `streaming: true` in config
2. Check bot has `can_edit_messages` permission
3. Some Telegram clients show a brief "message not modified" error — this is normal

### Webhook not receiving updates
1. Verify HTTPS certificate is valid
2. Check `TELEGRAM_WEBHOOK_SECRET` matches
3. Test with `curl -X POST https://your-url/telegram -H "X-Telegram-Bot-Api-Secret-Token: your-secret" -d '{}'`
