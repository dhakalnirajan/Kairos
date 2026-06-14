import type { KairosConfigOutput } from '../config/schema.ts';
import type { LLMClient, ChatMessage, StreamEvent } from '../llm/client.ts';
import type { ToolRegistry } from '../tools/registry.ts';
import type { ToolContext, ToolResult, AgentMode, AgentTurn } from '../types/tools.ts';
import type { MemoryDatabase } from '../memory/database.ts';
import { estimateTokens } from '../utils/tokenizer.ts';
import { eventBus } from '../hooks/bus.ts';
import { join } from 'path';

export interface AgentLoopConfig {
  maxIterations: number;
  mode: AgentMode;
  workspaceRoot: string;
  sessionId: string;
}

const DEFAULT_LOOP_CONFIG: AgentLoopConfig = {
  maxIterations: 20,
  mode: 'NORMAL',
  workspaceRoot: process.cwd(),
  sessionId: '',
};

export class AgentLoop {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private memory: MemoryDatabase;
  private config: KairosConfigOutput;
  private loopConfig: AgentLoopConfig;
  private turns: AgentTurn[] = [];
  private aborted = false;

  constructor(
    llm: LLMClient,
    tools: ToolRegistry,
    memory: MemoryDatabase,
    config: KairosConfigOutput,
    loopConfig?: Partial<AgentLoopConfig>,
  ) {
    this.llm = llm;
    this.tools = tools;
    this.memory = memory;
    this.config = config;
    this.loopConfig = { ...DEFAULT_LOOP_CONFIG, ...loopConfig };
  }

  abort(): void {
    this.aborted = true;
  }

  async run(userMessage: string): Promise<{ response: string; turns: AgentTurn[] }> {
    this.aborted = false;
    this.turns = [];

    const systemPrompt = await this.buildSystemPrompt();
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    const userTurn: AgentTurn = {
      id: `turn-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.turns.push(userTurn);
    messages.push({ role: 'user', content: userMessage });

    this.memory.insertConversationMessage({
      sessionId: this.loopConfig.sessionId,
      role: 'user',
      content: userMessage,
      tokenCount: estimateTokens(userMessage),
    });

    let iterations = 0;
    let finalResponse = '';

    while (iterations < this.loopConfig.maxIterations && !this.aborted) {
      iterations++;

      try {
        const stream = this.llm.stream(messages, {
          temperature: this.config.llm.temperature,
          maxTokens: this.config.llm.maxTokens,
        });

        let fullContent = '';

        for await (const event of stream) {
          if (this.aborted) break;

          if (event.type === 'token') {
            fullContent += event.content;
          }

          if (event.type === 'done') {
            this.memory.insertConversationMessage({
              sessionId: this.loopConfig.sessionId,
              role: 'assistant',
              content: fullContent,
              tokenCount: estimateTokens(fullContent),
            });
          }
        }

        if (this.aborted) break;

        const assistantTurn: AgentTurn = {
          id: `turn-${Date.now()}-assistant`,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        };
        this.turns.push(assistantTurn);
        messages.push({ role: 'assistant', content: fullContent });

        const toolCalls = this.extractToolCalls(fullContent);
        if (toolCalls.length === 0) {
          finalResponse = fullContent;
          break;
        }

        const toolContext: ToolContext = {
          workspaceRoot: this.loopConfig.workspaceRoot,
          sessionId: this.loopConfig.sessionId,
        };

        for (const call of toolCalls) {
          if (this.aborted) break;

          await eventBus.emit('pre_tool_execution', { toolName: call.name, parameters: call.parameters });
          const result = await this.tools.execute(call.name, call.parameters, toolContext, this.config);
          await eventBus.emit('post_tool_execution', { toolName: call.name, result });

          const toolTurn: AgentTurn = {
            id: `turn-${Date.now()}-tool`,
            role: 'tool',
            content: JSON.stringify({ tool: call.name, result }),
            timestamp: Date.now(),
            toolCalls: [{ id: `call-${Date.now()}`, ...call, result }],
          };
          this.turns.push(toolTurn);
          messages.push({
            role: 'user',
            content: `Tool result for ${call.name}: ${result.success ? result.output : result.error}`,
          });
        }

        finalResponse = '';
      } catch (error) {
        finalResponse = `Error: ${error}`;
        break;
      }
    }

    return { response: finalResponse, turns: this.turns };
  }

  async *stream(userMessage: string): AsyncGenerator<StreamEvent | { type: 'tool_call'; name: string; result: ToolResult }, void, undefined> {
    this.aborted = false;
    this.turns = [];

    const systemPrompt = await this.buildSystemPrompt();
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];

    const userTurn: AgentTurn = {
      id: `turn-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    this.turns.push(userTurn);
    messages.push({ role: 'user', content: userMessage });

    let iterations = 0;

    while (iterations < this.loopConfig.maxIterations && !this.aborted) {
      iterations++;

      try {
        let fullContent = '';

        const stream = this.llm.stream(messages, {
          temperature: this.config.llm.temperature,
          maxTokens: this.config.llm.maxTokens,
        });

        for await (const event of stream) {
          if (this.aborted) return;
          if (event.type === 'token') {
            fullContent += event.content;
            yield event;
          }
          if (event.type === 'done') {
            yield event;
          }
        }

        if (this.aborted) return;

        const assistantTurn: AgentTurn = {
          id: `turn-${Date.now()}-assistant`,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
        };
        this.turns.push(assistantTurn);
        messages.push({ role: 'assistant', content: fullContent });

        const toolCalls = this.extractToolCalls(fullContent);
        if (toolCalls.length === 0) return;

        const toolContext: ToolContext = {
          workspaceRoot: this.loopConfig.workspaceRoot,
          sessionId: this.loopConfig.sessionId,
        };

        for (const call of toolCalls) {
          if (this.aborted) return;
          const result = await this.tools.execute(call.name, call.parameters, toolContext, this.config);
          yield { type: 'tool_call', name: call.name, result };
          messages.push({
            role: 'user',
            content: `Tool result for ${call.name}: ${result.success ? result.output : result.error}`,
          });
        }
      } catch (error) {
        yield { type: 'token', content: `\nError: ${error}` };
        return;
      }
    }
  }

  private async buildSystemPrompt(): Promise<string> {
    const toolManifests = this.tools.getManifests();
    const toolDescriptions = toolManifests
      .map((t) => `- ${t.name}: ${t.description} (risk: ${t.riskLevel})`)
      .join('\n');

    let kairosMd = '';
    try {
      const kairosPath = join(this.loopConfig.workspaceRoot, 'KAIROS.md');
      const file = Bun.file(kairosPath);
      if (await file.exists()) {
        kairosMd = await file.text();
      }
    } catch {}

    if (kairosMd) {
      return `${kairosMd}

---

Mode: ${this.loopConfig.mode}

Available tools:
${toolDescriptions}

To use a tool, respond with a JSON code block:
\`\`\`tool
{"name": "tool_name", "parameters": {"param": "value"}}
\`\`\``;
    }

    const modeInstructions: Record<string, string> = {
      NORMAL: 'You are a helpful coding assistant. Use tools when needed.',
      PLAN: 'You are in planning mode. Only analyze and plan, do not make changes.',
      ULTRAPLAN: 'You are in deep planning mode. Think carefully and produce detailed plans.',
      AUTO: 'Execute tasks automatically without asking for confirmation.',
      YOLO: 'Execute everything automatically with maximum speed.',
    };

    return `You are Kairos, a terminal-native AI coding agent.

Mode: ${this.loopConfig.mode}
${modeInstructions[this.loopConfig.mode] ?? modeInstructions['NORMAL']}

Available tools:
${toolDescriptions}

IMPORTANT: Only use tools when the user explicitly asks you to read/write files, run commands, or perform actions. For simple questions like math, greetings, explanations, or general knowledge - answer directly WITHOUT using any tools.

To use a tool (only when needed), respond with a JSON code block:
\`\`\`tool
{"name": "tool_name", "parameters": {"param": "value"}}
\`\`\`

Be concise. Answer questions directly. Use tools only for file/code operations.`;
  }

  private extractToolCalls(content: string): Array<{ name: string; parameters: Record<string, unknown> }> {
    const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];

    const jsonBlockPattern = /```(?:tool|json)\s*\n([\s\S]*?)\n```/g;
    let match;
    while ((match = jsonBlockPattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown>;
        if (typeof parsed['name'] === 'string' && typeof parsed['parameters'] === 'object' && parsed['parameters'] !== null) {
          calls.push({ name: parsed['name'], parameters: parsed['parameters'] as Record<string, unknown> });
        }
      } catch {
        continue;
      }
    }

    const tagPattern = /<\|tool_call_start\|>(.*?)<\|tool_call_end\|>/g;
    while ((match = tagPattern.exec(content)) !== null) {
      const inner = match[1]?.trim().replace(/^\[|\]$/g, '') ?? '';
      const funcMatch = inner.match(/^(\w+)\((.*)\)$/s);
      if (funcMatch) {
        const name = funcMatch[1] ?? '';
        const argsStr = funcMatch[2] ?? '';
        const params: Record<string, unknown> = {};
        const kvPattern = /(\w+)="([^"]*)"/g;
        let kvMatch;
        while ((kvMatch = kvPattern.exec(argsStr)) !== null) {
          params[kvMatch[1] ?? ''] = kvMatch[2] ?? '';
        }
        if (name) {
          calls.push({ name, parameters: params });
        }
      }
    }

    return calls;
  }

  getMode(): AgentMode {
    return this.loopConfig.mode;
  }

  setMode(mode: AgentMode): void {
    this.loopConfig.mode = mode;
  }

  getTurns(): AgentTurn[] {
    return this.turns;
  }
}
