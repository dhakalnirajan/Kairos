# Protocols & Integrations

Kairos supports several integration protocols.

## Model Context Protocol (MCP)

MCP allows connecting to external tool servers.

### Setup

```bash
# Add MCP server
kairos mcp add --url http://localhost:3000 --name my-tools

# List servers
kairos mcp list

# Remove server
kioalnirajan.Kairos mcp remove --name my-tools
```

### MCP Client

```typescript
// Connect to MCP server
const client = new MCPClient();
await client.addServer({ name: 'my-tools', transport: 'stdio', command: 'my-server' });

// Register tools from MCP
client.registerTools(registry);
```

## LSP (Language Server Protocol)

Kairos includes an LSP bridge for code intelligence.

### Features

- Autocompletion
- Diagnostics (errors/warnings)
- Go to definition
- Find references
- Hover information
- Document symbols

### Usage

```bash
# Start LSP server
/lsp start typescript typescript-language-server --stdio

# Get completions
/lsp completions src/main.ts 10 5

# Get diagnostics
/lsp diagnostics src/main.ts

# Go to definition
/lsp definition src/main.ts 15 10
```

## DAP (Debug Adapter Protocol)

Kairos includes a DAP bridge for debugging.

### Features

- Breakpoint management
- Step debugging (over/into/out)
- Variable inspection
- Stack trace viewing
- Expression evaluation

### Usage

```bash
# Connect to debug adapter
/dap connect node --inspect

# Set breakpoint
/dap breakpoint set src/main.ts 42

# Continue execution
/dap continue

# Step over
/dap step-over

# View variables
/dap variables
```

## Daemon API

Kairos can run as a background daemon with an HTTP API.

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/query` | POST | Send a query |
| `/workers` | GET | View worker status |
| `/sessions` | GET | List sessions |
| `/shutdown` | POST | Shutdown daemon |

### Usage

```bash
# Start daemon
kairos daemon --port 7777

# Query daemon
curl -X POST http://localhost:7777/query \
  -H "Content-Type: application/json" \
  -d '{"message": "What files are here?"}'

# Health check
curl http://localhost:7777/health

# Shutdown
curl -X POST http://localhost:7777/shutdown
```

## Web Interface

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI |
| `/api/chat` | POST | Chat with streaming |
| `/api/tools` | GET | List available tools |
| `/api/status` | GET | System status |
| `/api/model` | POST | Switch model |
| `/api/mode` | POST | Switch mode |

### SSE Streaming

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello', stream: true })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process SSE events
}
```

## Extension System

### Extension Structure

```
~/.kairos/extensions/
  my-extension/
    manifest.json
    index.ts
```

### manifest.json

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "tools": [
    {
      "name": "my-tool",
      "description": "Custom tool",
      "handler": "index.ts"
    }
  ]
}
```

## Next Steps

- [API Reference](api-reference.md) — Programmatic API details
- [Tools](tools.md) — Available tools
