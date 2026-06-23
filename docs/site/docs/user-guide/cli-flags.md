---
title: CLI Flags
sidebar_position: 3
description: Complete CLI reference for Kairos.
---

# CLI Flags Reference

## General

| Flag | Short | Description |
|------|-------|-------------|
| `--help` | `-h` | Show help |
| `--version` | | Show version |

## Execution

| Flag | Short | Description |
|------|-------|-------------|
| `--print <query>` | `-p` | Run headless one-shot query |
| `--interactive` | `-i` | Interactive CLI mode |
| `--continue` | `-c` | Continue last session |
| `--no-tui` | | Skip TUI, use plain readline REPL |

## Model Configuration

| Flag | Description | Default |
|------|-------------|---------|
| `--model <name>` | LLM model name | Config default |
| `--provider <name>` | LLM provider | Config default |
| `--max-tokens <n>` | Max tokens per response | 8192 |
| `--temperature <n>` | Sampling temperature | 0.7 |

## Mode

| Flag | Description |
|------|-------------|
| `--mode <mode>` | Agent mode (NORMAL, PLAN, AUTO, YOLO, HEADLESS) |
| `--compose` | Use 8-step compose pipeline |
| `--yolo` | Skip all confirmations (alias for AUTO mode) |

## Safety

| Flag | Description |
|------|-------------|
| `--permission-mode <mode>` | Permission mode |
| `--dangerously-skip-permissions` | Skip all safety checks (DANGEROUS) |

## Server

| Flag | Description | Default |
|------|-------------|---------|
| `--web` | Start web interface | Port 3333 |
| `--port <n>` | Server port | 3333 |
| `--host <addr>` | Bind host | 0.0.0.0 |
| `--daemon` | Start as background daemon | |
| `--serve` | Start IDE bridge server | |

## Display

| Flag | Description |
|------|-------------|
| `--verbose` | Verbose output |
| `--debug` | Debug output |
| `--no-color` | Disable colors |
| `--no-stream` | Disable streaming |
| `--output-format <fmt>` | Output format (text, json, markdown) |

## Setup

| Flag | Description |
|------|-------------|
| `--quick` | Quick setup (skip prompts) |
| `--reset` | Reset config to defaults |

## Examples

```bash
# Headless query with specific model
kairos -p "Explain this code" --model gpt-4o

# Start with auto-approve mode
kairos --mode AUTO

# Web interface on custom port
kairos web --port 8080

# Daemon mode
kairos daemon --port 7777

# Quick setup
kairos setup --quick

# Continue last session in plan mode
kairos --continue --mode PLAN

# Plain REPL (no TUI)
kairos --no-tui
```

## Next Steps

- [Slash Commands](slash-commands.md) — In-session commands
- [Configuration](configuration.md) — Config file equivalents