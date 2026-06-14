import type { ToolManifest, ToolInstance, ToolContext, ToolResult } from '../types/tools.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import { SafetyPipeline } from '../security/pipeline.ts';

export class ToolRegistry {
  private tools = new Map<string, ToolInstance>();
  private safety = new SafetyPipeline();

  register(tool: ToolInstance): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolInstance | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolInstance[] {
    return Array.from(this.tools.values());
  }

  getManifests(): ToolManifest[] {
    return this.getAll().map(({ execute, ...manifest }) => manifest);
  }

  toOpenAITools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: unknown } }> {
    return this.getManifests().map((m) => ({
      type: 'function' as const,
      function: {
        name: m.name,
        description: m.description,
        parameters: m.parameters,
      },
    }));
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    ctx: ToolContext,
    config: KairosConfigOutput,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }

    const verdict = await this.safety.evaluate(
      name,
      params,
      tool.riskLevel,
      config,
      ctx.workspaceRoot,
    );

    if (!verdict.allowed) {
      return {
        success: false,
        output: '',
        error: `Safety block [${verdict.layer}]: ${verdict.reason ?? 'Operation not allowed'}`,
      };
    }

    return tool.execute(params, ctx);
  }
}
