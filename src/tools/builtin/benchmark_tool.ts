import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

const benchResults: Array<{ name: string; duration: number; ops: number; timestamp: number }> = [];

export const benchmarkTool: ToolInstance = {
  name: 'benchmark',
  description: 'Benchmarking assistant: baseline comparison, performance measurement, regression detection',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop', 'compare', 'report', 'clear'], description: 'Benchmark action' },
      name: { type: 'string', description: 'Benchmark name' },
      iterations: { type: 'number', description: 'Number of iterations' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const timers = new Map<string, number>();

    try {
      switch (action) {
        case 'start': {
          const name = String(params['name'] ?? `bench-${Date.now()}`);
          timers.set(name, performance.now());
          return { success: true, output: `Started benchmark: ${name}` };
        }
        case 'stop': {
          const name = String(params['name'] ?? '');
          const start = timers.get(name);
          if (!start) return { success: false, output: '', error: `No active benchmark: ${name}` };
          const duration = performance.now() - start;
          const iterations = Number(params['iterations'] ?? 1);
          const ops = Math.round((iterations / duration) * 1000);
          benchResults.push({ name, duration, ops, timestamp: Date.now() });
          timers.delete(name);
          return { success: true, output: `Benchmark "${name}": ${duration.toFixed(2)}ms (${ops} ops/s)`, metadata: { duration, ops } };
        }
        case 'compare': {
          const output = benchResults.map((r) => `${r.name}: ${r.duration.toFixed(2)}ms (${r.ops} ops/s)`).join('\n');
          return { success: true, output: output || 'No benchmark results', metadata: { count: benchResults.length } };
        }
        case 'report': {
          const byName = new Map<string, typeof benchResults>();
          for (const r of benchResults) {
            const existing = byName.get(r.name) ?? [];
            existing.push(r);
            byName.set(r.name, existing);
          }
          const output = Array.from(byName.entries()).map(([name, results]) => {
            const avg = results.reduce((s, r) => s + r.duration, 0) / results.length;
            const min = Math.min(...results.map((r) => r.duration));
            const max = Math.max(...results.map((r) => r.duration));
            return `${name}: avg=${avg.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(2)}ms (n=${results.length})`;
          }).join('\n');
          return { success: true, output: output || 'No results' };
        }
        case 'clear': {
          benchResults.length = 0;
          return { success: true, output: 'Benchmarks cleared' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Benchmark failed: ${e}` };
    }
  },
};
