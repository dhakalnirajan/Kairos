import type { KairosConfigOutput } from '../config/schema.ts';
import type { LLMClient, ChatMessage } from '../llm/client.ts';
import type { ToolRegistry } from '../tools/registry.ts';
import type { MemoryDatabase } from '../memory/database.ts';
import type { ToolContext, ToolResult } from '../types/tools.ts';
import { estimateTokens } from '../utils/tokenizer.ts';

export interface ComposeStep {
  name: string;
  description: string;
  systemPrompt: string;
  useTools: boolean;
}

export const COMPOSE_STEPS: ComposeStep[] = [
  { name: 'spec', description: 'Generate requirements', systemPrompt: 'You are a technical writer. Generate a clear requirements specification for the task.', useTools: false },
  { name: 'plan', description: 'Create architecture plan', systemPrompt: 'You are a software architect. Create a step-by-step implementation plan.', useTools: false },
  { name: 'execute', description: 'Run plan steps with tools', systemPrompt: 'You are an implementation agent. Execute each step using available tools. Use JSON code blocks to call tools.', useTools: true },
  { name: 'review', description: 'Self-critique output', systemPrompt: 'You are a code reviewer. Critically review the implementation for bugs and improvements.', useTools: false },
  { name: 'tdd', description: 'Write and run tests', systemPrompt: 'You are a test engineer. Write tests and run them using bash tool.', useTools: true },
  { name: 'debug', description: 'Auto-fix failures', systemPrompt: 'You are a debugger. Fix any failing tests or errors.', useTools: true },
  { name: 'verify', description: 'Final validation', systemPrompt: 'You are a QA engineer. Verify the implementation meets the spec.', useTools: false },
  { name: 'merge', description: 'Git commit', systemPrompt: 'You are a release engineer. Create a proper git commit.', useTools: true },
];

export class ComposePipeline {
  private llm: LLMClient;
  private tools: ToolRegistry;
  private memory: MemoryDatabase;
  private config: KairosConfigOutput;
  private workspaceRoot: string;
  private currentStep = 0;
  private aborted = false;

  constructor(
    llm: LLMClient,
    tools: ToolRegistry,
    memory: MemoryDatabase,
    config: KairosConfigOutput,
    workspaceRoot: string,
  ) {
    this.llm = llm;
    this.tools = tools;
    this.memory = memory;
    this.config = config;
    this.workspaceRoot = workspaceRoot;
  }

  abort(): void {
    this.aborted = true;
  }

  getCurrentStep(): ComposeStep {
    return COMPOSE_STEPS[this.currentStep] ?? COMPOSE_STEPS[COMPOSE_STEPS.length - 1]!;
  }

  getProgress(): { current: number; total: number; stepName: string } {
    return {
      current: this.currentStep + 1,
      total: COMPOSE_STEPS.length,
      stepName: this.getCurrentStep().name,
    };
  }

  async run(task: string): Promise<{ result: string; steps: Array<{ step: string; output: string }> }> {
    this.aborted = false;
    this.currentStep = 0;
    const results: Array<{ step: string; output: string }> = [];
    let context = task;

    const toolManifests = this.tools.getManifests();
    const toolDescriptions = toolManifests.map((t) => `- ${t.name}: ${t.description}`).join('\n');

    for (let i = 0; i < COMPOSE_STEPS.length && !this.aborted; i++) {
      this.currentStep = i;
      const step = COMPOSE_STEPS[i]!;

      const toolSection = step.useTools ? `\n\nAvailable tools:\n${toolDescriptions}\n\nTo use a tool, respond with a JSON code block:\n\`\`\`tool\n{"name": "tool_name", "parameters": {"param": "value"}}\n\`\`\`` : '';

      const messages: ChatMessage[] = [
        { role: 'system', content: step.systemPrompt + toolSection },
        { role: 'user', content: context },
      ];

      let output = '';

      for (let iteration = 0; iteration < (step.useTools ? 5 : 1) && !this.aborted; iteration++) {
        try {
          const stream = this.llm.stream(messages, {
            temperature: this.config.llm.temperature,
            maxTokens: this.config.llm.maxTokens,
          });

          let stepOutput = '';
          for await (const event of stream) {
            if (this.aborted) break;
            if (event.type === 'token') {
              stepOutput += event.content;
            }
          }

          output = stepOutput;

          if (!step.useTools) break;

          const toolCalls = this.extractToolCalls(stepOutput);
          if (toolCalls.length === 0) break;

          messages.push({ role: 'assistant', content: stepOutput });

          const toolContext: ToolContext = {
            workspaceRoot: this.workspaceRoot,
            sessionId: `compose-${this.currentStep}-${Date.now()}`,
          };

          for (const call of toolCalls) {
            if (this.aborted) break;
            const result = await this.tools.execute(call.name, call.parameters, toolContext, this.config);
            messages.push({
              role: 'user',
              content: `Tool result for ${call.name}: ${result.success ? result.output.slice(0, 2000) : result.error}`,
            });
          }
        } catch (error) {
          output = `Step failed: ${error}`;
          break;
        }
      }

      results.push({ step: step.name, output });
      context += `\n\n--- Step ${step.name} Output ---\n${output}`;
    }

    this.currentStep = COMPOSE_STEPS.length;
    return { result: results[results.length - 1]?.output ?? '', steps: results };
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
