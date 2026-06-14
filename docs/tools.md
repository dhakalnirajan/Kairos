# Built-in Tools

Kairos provides 10 built-in tools with automatic safety classification.

## Filesystem Tools

| Tool | Risk | Description |
|------|------|-------------|
| `read_file` | read | Read file contents |
| `write_file` | write | Write/create files |
| `edit_file` | write | Edit files with exact match |
| `glob` | read | Find files by pattern |
| `grep` | read | Search file contents |

## Shell Tool

| Tool | Risk | Description |
|------|------|-------------|
| `bash` | execute | Run shell commands with timeout |

## Web Tools

| Tool | Risk | Description |
|------|------|-------------|
| `http_fetch` | network | Fetch web content |
| `web_search` | network | Search the web |

## Version Control

| Tool | Risk | Description |
|------|------|-------------|
| `git` | read/write | Git operations |

## Memory

| Tool | Risk | Description |
|------|------|-------------|
| `memory_ops` | read/write | Persistent memory CRUD |

## Tool Usage

Tools are invoked via JSON code blocks in assistant responses:

```json
{
  "name": "read_file",
  "parameters": {
    "path": "src/main.ts"
  }
}
```

## Custom Tools

Add custom tools in `~/.kairos/plugins/`:

```typescript
import type { ToolInstance } from 'kairos-code';

export const myTool: ToolInstance = {
  name: 'my_tool',
  description: 'My custom tool',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' }
    },
    required: ['input']
  },
  riskLevel: 'read',
  isIdempotent: true,
  async execute(params, ctx) {
    return { success: true, output: 'done' };
  }
};
```
