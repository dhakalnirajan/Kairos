# Protocols

## MCP Protocol

Model Context Protocol (MCP) enables integration with external tool servers.

### Transport Types

| Type | Description |
|------|-------------|
| `stdio` | Standard input/output communication |
| `sse` | Server-Sent Events over HTTP |

### Configuration

```json
{
  "mcp": {
    "servers": [
      {
        "name": "my-server",
        "transport": "stdio",
        "command": "node",
        "args": ["server.js"]
      }
    ]
  }
}
```

## Event System

Kairos uses an event bus for hook execution.

### Event Types

| Event | When |
|-------|------|
| `session_start` | Session begins |
| `pre_tool_execution` | Before tool runs |
| `post_tool_execution` | After tool runs |
| `on_error` | Error occurs |
| `pre_commit` | Before git commit |
| `pre_turn` | Before agent turn |
| `post_turn` | After agent turn |

### Hook Scripts

Place shell scripts in `~/.kairos/hooks/`:

```bash
#!/bin/sh
# @event pre_tool
# @enabled
echo "Tool about to run: $KAIROS_HOOK_DATA"
```

## Tool Protocol

Tools implement the `ToolInstance` interface:

```typescript
interface ToolInstance {
  name: string;
  description: string;
  parameters: JSONSchema;
  riskLevel: 'read' | 'write' | 'execute' | 'network';
  isIdempotent: boolean;
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}
```

## LLM Protocol

All LLM clients implement:

```typescript
abstract class LLMClient {
  abstract chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  abstract stream(messages: ChatMessage[], opts?: ChatOptions): AsyncGenerator<StreamEvent>;
  abstract embed(text: string): Promise<EmbeddingResult>;
}
```
