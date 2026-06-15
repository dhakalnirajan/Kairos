# API Reference

## Agent Loop

```typescript
import { AgentLoop } from './agent/loop.ts';
import { createLLMClient } from './llm/client.ts';
import { ToolRegistry } from './tools/registry.ts';
import { MemoryDatabase } from './memory/database.ts';

// Create agent
const llm = createLLMClient(config.llm);
const tools = new ToolRegistry();
await registerAllBuiltinTools(tools);
const memory = new MemoryDatabase(dbPath);

const agent = new AgentLoop(llm, tools, memory, config, {
  mode: 'NORMAL',
  workspaceRoot: process.cwd(),
  sessionId: 'my-session',
});

// Run query
const response = await agent.run('What files are here?');
console.log(response.response);

// Stream query
for await (const event of agent.stream('Explain this code')) {
  if (event.type === 'token') {
    process.stdout.write(event.content);
  }
}
```

## LLM Client

```typescript
import { createLLMClient } from './llm/client.ts';

const client = createLLMClient({
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Non-streaming
const result = await client.chat([
  { role: 'user', content: 'Hello' }
], { maxTokens: 1024 });

// Streaming
for await (const event of client.stream([
  { role: 'user', content: 'Hello' }
])) {
  if (event.type === 'token') {
    console.log(event.content);
  }
}
```

## Tool Registry

```typescript
import { ToolRegistry } from './tools/registry.ts';

const registry = new ToolRegistry();

// Register custom tool
registry.register({
  name: 'my-tool',
  description: 'Custom tool',
  parameters: { type: 'object', properties: {} },
  riskLevel: 'read',
  isIdempotent: true,
  async execute(params, ctx) {
    return { success: true, output: 'Result' };
  },
});

// Execute tool
const result = await registry.execute('my-tool', {}, ctx, config);

// Get OpenAI tool definitions
const tools = registry.toOpenAIToolDefs();
```

## Memory Database

```typescript
import { MemoryDatabase } from './memory/database.ts';

const db = new MemoryDatabase(dbPath);

// Store fact
db.insertTopicFact({
  topic: 'architecture',
  fact: 'Uses SQLite with FTS5',
  embedding: null,
});

// Search
const results = db.search('database', 10);

// Get context block
const context = db.buildContextBlock(4000, sessionId);

// Dream consolidation
const facts = db.extractForDream(sessionId);
```

## Provider Manager

```typescript
import { LLMProviderManager } from './llm/manager.ts';

const manager = new LLMProviderManager({
  preferredProvider: 'anthropic',
  fallbackEnabled: true,
});

// Discover local providers
const discovered = await manager.discoverLocal();

// Switch provider
await manager.switchTo('ollama');

// List providers
const providers = manager.listProviders();
```

## Safety Pipeline

```typescript
import { SafetyPipeline } from './security/pipeline.ts';

const safety = new SafetyPipeline();

// Evaluate tool call
const verdict = await safety.evaluate(
  'bash',
  { command: 'ls -la' },
  'execute',
  config,
  workspaceRoot,
);

if (!verdict.allowed) {
  console.log(`Blocked: ${verdict.reason}`);
}
```

## TUI

```typescript
import { TUI } from './tui/index.ts';

const tui = new TUI(config, tools, sessionId);
await tui.start();

tui.onInput(async (text) => {
  tui.appendMessage('user', text);
  // Process input...
  tui.appendMessage('assistant', response);
});

tui.updateStatus({ mode, model, tokens, cost });
```

## Event Bus

```typescript
import { eventBus } from './hooks/bus.ts';

// Register handler
eventBus.on('pre_tool_execution', async (payload) => {
  console.log('Tool executing:', payload.data.toolName);
});

// Emit event
await eventBus.emit('post_tool_execution', { toolName: 'bash', result });
```

## Compose Pipeline

```typescript
import { ComposePipeline } from './agent/compose.ts';

const pipeline = new ComposePipeline(llm, tools, memory, config, workspaceRoot);

// Run full compose pipeline
const result = await pipeline.run('Implement user authentication');

// Get progress
const progress = pipeline.getProgress();
console.log(`Step ${progress.current}/${progress.total}: ${progress.stepName}`);
```

## Next Steps

- [Tools](tools.md) — All available tools
- [Protocols](protocols.md) — Integration protocols
