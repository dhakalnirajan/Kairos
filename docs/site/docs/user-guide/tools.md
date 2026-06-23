---
title: Tools
sidebar_position: 7
description: 82 built-in tools organized by category.
---

# Built-in Tools

Kairos provides 82 built-in tools organized by category.

## Tool Categories

### File Operations (5)

| Tool | Risk | Description |
|------|------|-------------|
| `read_file` | read | Read file contents with offset/limit |
| `write_file` | write | Create or overwrite files |
| `edit_file` | write | Exact string replacement |
| `glob` | read | Find files by pattern |
| `grep` | read | Search file contents with regex |

### Shell (1)

| Tool | Risk | Description |
|------|------|-------------|
| `bash` | execute | Execute shell commands with timeout |

### Web (2)

| Tool | Risk | Description |
|------|------|-------------|
| `http_fetch` | network | Fetch URL content (SSRF-protected) |
| `web_search` | network | Search the web via DuckDuckGo |

### Git (1)

| Tool | Risk | Description |
|------|------|-------------|
| `git` | read/write | Git operations (status, diff, log, add, commit, branch) |

### Memory (1)

| Tool | Risk | Description |
|------|------|-------------|
| `memory_ops` | read/write | Search, store, retrieve facts from memory |

### Code Analysis (2)

| Tool | Risk | Description |
|------|------|-------------|
| `ast_analysis` | read | AST scanning, symbols, dependencies, dead code |
| `codemod` | write | AST-based code transformations |

### Debugging (3)

| Tool | Risk | Description |
|------|------|-------------|
| `debug_adapter` | execute | DAP protocol connection |
| `interactive_debug` | read | Hypothesis-driven debugging |
| `heap_snapshot` | read | Memory usage analysis |

### Documentation (3)

| Tool | Risk | Description |
|------|------|-------------|
| `docs_sync` | read | Living documentation sync |
| `adr_keeper` | read | Architecture Decision Records |
| `changelog` | read | Changelog generation |

### Security (3)

| Tool | Risk | Description |
|------|------|-------------|
| `security_scan` | read | Scan for secrets and vulnerabilities |
| `supply_chain` | read | Dependency audit |
| `advisories` | read | Security advisory watcher |

### Performance (2)

| Tool | Risk | Description |
|------|------|-------------|
| `performance_analysis` | read | Bundle size and pattern analysis |
| `query_optimisation` | read | Slow query detection |

### Collaboration (2)

| Tool | Risk | Description |
|------|------|-------------|
| `code_review` | read | Code review simulation |
| `pair_programming` | read | Real-time code review |

### Automation (3)

| Tool | Risk | Description |
|------|------|-------------|
| `git_bisect` | execute | Automated bisect |
| `git_hooks` | write | Git hook management |
| `env_doctor` | read | Environment diagnostics |

### Memory & Knowledge (3)

| Tool | Risk | Description |
|------|------|-------------|
| `knowledge` | read | Knowledge graph |
| `semantic` | read | Semantic search |
| `learning` | read | Preference learning |

### Session (3)

| Tool | Risk | Description |
|------|------|-------------|
| `session_recorder` | read | Session recording |
| `session_continuity` | read | Cross-session tasks |
| `branch_diff` | read | Session comparison |

### Planning (2)

| Tool | Risk | Description |
|------|------|-------------|
| `parallel` | read | DAG-based execution planning |
| `workflow` | read | Workflow automation |

### Progress (3)

| Tool | Risk | Description |
|------|------|-------------|
| `progress` | read | Multi-step progress tracking |
| `progress_indicator` | read | ETA calculation |
| `time_tracking` | read | Time tracking |

### Agent (2)

| Tool | Risk | Description |
|------|------|-------------|
| `persona` | read | Agent persona management |
| `thinking` | read | Chain-of-thought transparency |

### Project (3)

| Tool | Risk | Description |
|------|------|-------------|
| `dependency_graph` | read | Import graph analysis |
| `test_first` | write | Test skeleton generation |
| `arch_sketch` | read | ASCII architecture diagrams |

### TUI (2)

| Tool | Risk | Description |
|------|------|-------------|
| `quick_commands` | read | Context-aware suggestions |
| `chat_widgets` | read | Custom status bar widgets |

### Other (8)

| Tool | Risk | Description |
|------|------|-------------|
| `alias` | read | Command aliases |
| `metrics` | read | Quality metrics |
| `undo` | read | Undo history |
| `achievements` | read | Milestones and badges |
| `templates` | write | File templates |
| `mood_adaptive` | read | Mood detection |
| `offline_mode` | read | Offline capabilities |
| `encrypted_vault` | write | Secret storage |

## Tool Usage in Agent

Tools are invoked via JSON code blocks in the agent's response:

````
```tool
{"name": "read_file", "parameters": {"path": "src/main.ts"}}
```
````

## Tool Safety

Every tool call passes through the 4-layer safety pipeline:
1. Input sanitization
2. Harm detection
3. Risk classification
4. Policy check
5. Path confinement
6. HITL approval (if required)

## Custom Tools

Register custom tools via the extension system:

```json
{
  "name": "my-tool",
  "description": "Custom tool",
  "parameters": { ... },
  "handler": "path/to/handler.ts"
}
```

## Next Steps

- [Safety](safety.md) — Tool safety pipeline
- [Tools API](../reference/api.md) — Programmatic tool usage