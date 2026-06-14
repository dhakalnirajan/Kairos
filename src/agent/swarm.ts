import type { KairosConfigOutput } from '../config/schema.ts';
import type { LLMClient, ChatMessage } from '../llm/client.ts';
import type { ToolRegistry } from '../tools/registry.ts';
import type { MemoryDatabase } from '../memory/database.ts';
import type { ToolContext, ToolResult } from '../types/tools.ts';
import { estimateTokens } from '../utils/tokenizer.ts';

export interface SwarmTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  workerId?: number;
  tokensUsed: number;
  startedAt?: number;
  completedAt?: number;
}

export interface SwarmConfig {
  maxWorkers: number;
  maxTokensPerWorker: number;
  maxIterationsPerWorker: number;
  timeout: number;
}

const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  maxWorkers: 3,
  maxTokensPerWorker: 4096,
  maxIterationsPerWorker: 10,
  timeout: 120_000,
};

export class SwarmCoordinator {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private memory: MemoryDatabase;
  private config: KairosConfigOutput;
  private swarmConfig: SwarmConfig;
  private tasks: SwarmTask[] = [];
  private aborted = false;

  constructor(
    llm: LLMClient,
    tools: ToolRegistry,
    memory: MemoryDatabase,
    config: KairosConfigOutput,
    swarmConfig?: Partial<SwarmConfig>,
  ) {
    this.llm = llm;
    this.tools = tools;
    this.memory = memory;
    this.config = config;
    this.swarmConfig = { ...DEFAULT_SWARM_CONFIG, ...swarmConfig };
  }

  abort(): void {
    this.aborted = true;
  }

  getProgress(): { total: number; completed: number; failed: number; running: number } {
    return {
      total: this.tasks.length,
      completed: this.tasks.filter((t) => t.status === 'completed').length,
      failed: this.tasks.filter((t) => t.status === 'failed').length,
      running: this.tasks.filter((t) => t.status === 'running').length,
    };
  }

  getTasks(): SwarmTask[] {
    return [...this.tasks];
  }

  async run(task: string): Promise<{ result: string; tasks: SwarmTask[] }> {
    this.aborted = false;
    this.tasks = [];

    const decomposed = await this.decomposeTask(task);
    this.tasks = decomposed.map((t, i) => ({
      id: `swarm-${i}`,
      description: t,
      status: 'pending' as const,
      tokensUsed: 0,
    }));

    const maxConcurrent = Math.min(this.swarmConfig.maxWorkers, this.tasks.length);
    const running = new Set<Promise<void>>();

    for (const taskItem of this.tasks) {
      if (this.aborted) break;

      while (running.size >= maxConcurrent) {
        await Promise.race(running);
      }

      const workerPromise = this.executeWorker(taskItem);
      running.add(workerPromise);
      workerPromise.then(() => running.delete(workerPromise)).catch(() => running.delete(workerPromise));
    }

    await Promise.all(running);

    const aggregated = await this.aggregateResults();

    return {
      result: aggregated,
      tasks: this.tasks,
    };
  }

  private async decomposeTask(task: string): Promise<string[]> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a task decomposer. Break the given task into independent subtasks that can be executed in parallel. Return each subtask on a new line, prefixed with a number. Be concise. Aim for 2-5 subtasks.',
      },
      { role: 'user', content: task },
    ];

    try {
      const result = await this.llm.chat(messages, {
        maxTokens: 1024,
        temperature: 0.3,
      });

      const lines = result.content.split('\n').filter((l) => l.trim());
      const subtasks = lines
        .map((l) => l.replace(/^\d+[\.\)]\s*/, '').trim())
        .filter((l) => l.length > 5);

      return subtasks.length > 0 ? subtasks : [task];
    } catch {
      return [task];
    }
  }

  private async executeWorker(task: SwarmTask): Promise<void> {
    task.status = 'running';
    task.workerId = Math.floor(Math.random() * 1000);
    task.startedAt = Date.now();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a worker agent in a swarm. Execute the given subtask independently. Use tools if needed. Be concise and focused.`,
      },
      { role: 'user', content: task.description },
    ];

    let iterations = 0;

    try {
      while (iterations < this.swarmConfig.maxIterationsPerWorker && !this.aborted) {
        iterations++;

        const result = await this.llm.chat(messages, {
          maxTokens: this.swarmConfig.maxTokensPerWorker,
          temperature: 0.7,
        });

        task.tokensUsed += estimateTokens(result.content);

        if (task.tokensUsed > this.swarmConfig.maxTokensPerWorker) {
          task.result = result.content;
          break;
        }

        const toolCalls = this.extractToolCalls(result.content);
        if (toolCalls.length === 0) {
          task.result = result.content;
          break;
        }

        messages.push({ role: 'assistant', content: result.content });

        const toolContext: ToolContext = {
          workspaceRoot: process.cwd(),
          sessionId: `swarm-${task.id}`,
        };

        for (const call of toolCalls) {
          if (this.aborted) break;
          const toolResult = await this.tools.execute(call.name, call.parameters, toolContext, this.config);
          messages.push({
            role: 'user',
            content: `Tool result for ${call.name}: ${toolResult.success ? toolResult.output.slice(0, 1000) : toolResult.error}`,
          });
        }
      }

      task.status = 'completed';
    } catch (e) {
      task.status = 'failed';
      task.error = String(e);
    }

    task.completedAt = Date.now();
  }

  private async aggregateResults(): Promise<string> {
    const completed = this.tasks.filter((t) => t.status === 'completed');
    if (completed.length === 0) return 'No tasks completed successfully.';

    const results = completed.map((t) => `## ${t.description}\n${t.result ?? '(no result)'}`).join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a result aggregator. Combine the following worker results into a coherent, concise summary. Remove redundancy.',
      },
      { role: 'user', content: results },
    ];

    try {
      const result = await this.llm.chat(messages, {
        maxTokens: 2048,
        temperature: 0.3,
      });
      return result.content;
    } catch {
      return results;
    }
  }

  private extractToolCalls(content: string): Array<{ name: string; parameters: Record<string, unknown> }> {
    const calls: Array<{ name: string; parameters: Record<string, unknown> }> = [];
    const pattern = /```(?:tool|json)\s*\n([\s\S]*?)\n```/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown>;
        if (typeof parsed['name'] === 'string' && typeof parsed['parameters'] === 'object' && parsed['parameters'] !== null) {
          calls.push({ name: parsed['name'], parameters: parsed['parameters'] as Record<string, unknown> });
        }
      } catch { continue; }
    }
    return calls;
  }
}
