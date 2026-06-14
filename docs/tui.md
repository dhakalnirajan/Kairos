# Terminal UI

Kairos provides a full-featured terminal user interface.

## Layout

```
┌─────────────────────────┬─────────────┐
│                         │             │
│         Chat            │   Context   │
│         (70%)           │    (30%)    │
│                         │             │
├─────────────────────────┴─────────────┤
│ Status Bar                            │
└───────────────────────────────────────┘
┌───────────────────────────────────────┐
│ Input                                 │
└───────────────────────────────────────┘
```

## Features

### Mascot Animation
- Metallic shining effect with color gradient sweep
- KAIROS in #208AAE, CODE in #A0A0A0
- Sweeps left-to-right when agent is thinking

### Command Palette
- Press `Ctrl+K` to open
- Fuzzy search across 110+ commands
- Keyboard navigation

### Smart Scroll
- Auto-scroll during streaming
- Halt on manual scroll
- Resume on new message

### Mouse Support
- Clickable panes
- Scroll wheel
- Double-click selection

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Exit |
| `Ctrl+K` | Command palette |
| `Ctrl+P` | File picker |
| `Tab` | Autocomplete |
| `Up/Down` | History |

## Themes

```bash
kairos --theme dark
kairos --theme light
kairos --theme monokai
kairos --theme dracula
```

## Configuration

```json
{
  "tui": {
    "theme": "default",
    "showTimestamps": true,
    "showTokenCount": true,
    "compactMode": false
  }
}
```
