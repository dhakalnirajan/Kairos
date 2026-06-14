# API Reference

## LLMClient

```typescript
abstract class LLMClient {
  abstract chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  abstract stream(messages: ChatMessage[], opts?: ChatOptions): AsyncGenerator<StreamEvent>;
  abstract embed(text: string): Promise<EmbeddingResult>;
  probe?(): Promise<boolean>;
}
```

## LLMProviderManager

```typescript
class LLMProviderManager {
  constructor(config?: ManagerConfig);
  discoverLocal(): Promise<ProviderStatus[]>;
  listProviders(): ProviderDefinition[];
  switchTo(name: string, apiKey?: string): Promise<boolean>;
  validateConnection(): Promise<{ available: boolean; provider: string; error?: string }>;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  stream(messages: ChatMessage[], opts?: ChatOptions): AsyncGenerator<StreamEvent>;
}
```

## ToolInstance

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

## SafetyPipeline

```typescript
class SafetyPipeline {
  evaluate(toolName: string, params: Record<string, unknown>, riskLevel: string, config: KairosConfigOutput, workspaceRoot: string): Promise<SafetyVerdict>;
  evaluateWithAudit(...): Promise<SafetyVerdict>;
  getAuditLog(limit?: number): AuditEntry[];
}
```

## AgentLoop

```typescript
class AgentLoop {
  constructor(llm: LLMClient, tools: ToolRegistry, memory: MemoryDatabase, config: KairosConfigOutput, loopConfig?: Partial<AgentLoopConfig>);
  run(userMessage: string): Promise<{ response: string; turns: AgentTurn[] }>;
  stream(userMessage: string): AsyncGenerator<StreamEvent | ToolCallEvent>;
  abort(): void;
  setMode(mode: AgentMode): void;
}
```

## Types

```typescript
type LLMProvider = 'llamacpp' | 'openai' | 'ollama' | 'anthropic' | 'gemini' | ...;
type AgentMode = 'NORMAL' | 'PLAN' | 'AUTO' | 'YOLO' | 'HEADLESS' | ...;

interface ChatMessage { role: string; content: string; }
interface ChatResult { content: string; usage: TokenUsage; }
interface StreamEvent { type: 'token' | 'done'; content?: string; }
interface ToolResult { success: boolean; output: string; error?: string; }
```
