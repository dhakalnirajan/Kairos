---
title: Slash Commands
sidebar_position: 4
description: All ~111 slash commands available in Kairos.
---

# Slash Commands

Kairos provides ~111 slash commands accessible in the TUI and web interface.

## Session Management

| Command | Description |
|---------|-------------|
| `/help` | Show all available commands |
| `/clear` | Clear the chat |
| `/quit` or `/exit` | Exit Kairos |
| `/status` | Show system status |
| `/version` | Show version info |
| `/cost` | Show token usage and estimated cost |
| `/model <name>` | Switch LLM model |
| `/mode <mode>` | Switch agent mode |
| `/theme <name>` | Switch TUI theme |
| `/export` | Export session (md/html/json) |

## Memory

| Command | Description |
|---------|-------------|
| `/recall <query>` | Search memory for matching entries |
| `/remember <fact>` | Store a fact in memory |
| `/forget` | Clear memory |
| `/rules` | Show learned preference rules |
| `/dream` | Consolidate memory (extract key facts) |
| `/compact` | Summarize and compact context |
| `/compress` | Compress old scratch entries |

## Code Analysis

| Command | Description |
|---------|-------------|
| `/review` | Review code for issues |
| `/test` | Run tests |
| `/lint` | Run linter |
| `/format` | Format code |
| `/explain` | Explain code |
| `/fix` | Auto-fix issues |
| `/optimize` | Suggest optimizations |
| `/refactor` | Suggest refactors |
| `/security` | Security scan |
| `/cleanup` | Dead code detection |

## Tools

| Command | Description |
|---------|-------------|
| `/diff` | Show file diff |
| `/git <action>` | Git operations |
| `/commit` | Create git commit |
| `/branch <name>` | Create/switch branch |
| `/merge <branch>` | Merge branch |
| `/stash` | Stash changes |
| `/log` | Show git log |

## Documentation

| Command | Description |
|---------|-------------|
| `/docs-sync` | Sync documentation |
| `/adr` | Architecture Decision Records |
| `/changelog` | Generate changelog |
| `/meeting-notes` | Meeting notes integration |

## Performance

| Command | Description |
|---------|-------------|
| `/bench` | Run benchmarks |
| `/metrics` | Show quality metrics |
| `/query-opt` | Query optimization analysis |

## Security

| Command | Description |
|---------|-------------|
| `/security-scan` | Scan for vulnerabilities |
| `/advisories` | Check security advisories |
| `/vault` | Encrypted secret storage |
| `/license-check` | Check license compatibility |
| `/supply-chain` | Supply chain audit |

## Project Management

| Command | Description |
|---------|-------------|
| `/tasks` | List tasks |
| `/task add <desc>` | Add a task |
| `/workflow` | Workflow automation |
| `/campaign` | Refactoring campaigns |

## Development

| Command | Description |
|---------|-------------|
| `/bootstrap` | Generate project scaffolding |
| `/migrate` | Database migration |
| `/generate-api-docs` | Generate API documentation |
| `/transpile` | Code transpilation |
| `/modernise` | Legacy code modernisation |

## Meta

| Command | Description |
|---------|-------------|
| `/persona <name>` | Switch agent persona |
| `/focus` | Enter focus mode |
| `/handoff` | Session handoff |
| `/branch-diff` | Compare session branches |

## Usage Examples

```bash
# In TUI
> /review src/main.ts
> /test --watch
> /commit -m "feat: add new feature"
> /recall authentication
> /persona auditor
> /bench myFunction
```

## Next Steps

- [Tools](tools.md) — 82 built-in tools
- [Safety](safety.md) — Safety pipeline