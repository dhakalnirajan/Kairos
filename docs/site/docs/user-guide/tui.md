---
title: Terminal UI
sidebar_position: 9
description: Terminal UI guide for Kairos.
---

# Terminal UI (TUI)

Kairos features a beautiful terminal UI built with neo-blessed.

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Status Bar (mode, model, tokens, cost)                      │
├──────────────────────────────┬──────────────────────────────┤
│                              │ Context                      │
│  Chat Panel                  │ ├─ Session Info              │
│  (conversation history)      │ ├─ Memory                    │
│                              │ └─ Tools                     │
│                              │                              │
├──────────────────────────────┴──────────────────────────────┤
│ Input (type here, Enter to send, ↑/↓ for history)           │
└─────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `↑` / `↓` | Navigate history |
| `Tab` | Cycle mode (NORMAL → PLAN → AUTO → NORMAL) |
| `Ctrl+K` | Open command palette |
| `Ctrl+P` | Open file picker |
| `Ctrl+C` | Exit |
| `Ctrl+D` | Exit |

## Themes

Available themes:
- `default` — Dark blue/teal
- `dark` — GitHub dark
- `light` — Light theme
- `monokai` — Monokai colors
- `dracula` — Dracula theme

Switch themes:
```bash
/theme dracula
```

## Status Bar

Shows:
- **Mode** — Current agent mode (color-coded)
- **Model** — Active LLM model
- **Tokens** — Token count
- **Cost** — Estimated cost

## Panels

### Chat Panel
- Displays conversation history
- Role-colored headers (User/Assistant/Tool)
- Auto-scrolls to bottom
- Streaming support

### Context Panel
- Session information
- Memory entries
- Tool usage log

### Command Palette
Press `Ctrl+K` to open:
- Fuzzy search commands
- Select with Enter
- Cancel with Escape

## TUI Themes

```typescript
const THEMES = {
  default: { primary: '#208AAE', bg: '#1A1A2E', fg: '#E0E0E0', ... },
  dark:    { primary: '#4A90D9', bg: '#0D1117', fg: '#C9D1D9', ... },
  light:   { primary: '#0366D6', bg: '#FFFFFF', fg: '#24292E', ... },
  monokai: { primary: '#A6E22E', bg: '#272822', fg: '#F8F8F2', ... },
  dracula: { primary: '#BD93F9', bg: '#282A36', fg: '#F8F8F2', ... },
};
```

## Next Steps

- [Configuration](configuration.md) — TUI configuration options
- [Slash Commands](slash-commands.md) — Available commands