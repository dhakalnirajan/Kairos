import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export const bisectTool: ToolInstance = {
  name: 'git_bisect',
  description: 'Automated git bisect: find the commit that introduced a bug using binary search',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'good', 'bad', 'run', 'status', 'reset'], description: 'Bisect action' },
      ref: { type: 'string', description: 'Commit ref for good/bad' },
      command: { type: 'string', description: 'Test command for automated bisect' },
    },
    required: ['action'],
  },
  riskLevel: 'execute' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const ref = String(params['ref'] ?? '');
    const command = String(params['command'] ?? '');

    async function gitBisect(args: string[]): Promise<{ stdout: string; exitCode: number }> {
      const proc = Bun.spawn(['git', 'bisect', ...args], { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      return { stdout, exitCode };
    }

    try {
      switch (action) {
        case 'start': {
          const { stdout } = await gitBisect(['start']);
          return { success: true, output: stdout || 'Bisect started' };
        }
        case 'good': {
          if (!ref) return { success: false, output: '', error: 'ref required' };
          const { stdout } = await gitBisect(['good', ref]);
          return { success: true, output: stdout };
        }
        case 'bad': {
          if (!ref) return { success: false, output: '', error: 'ref required' };
          const { stdout } = await gitBisect(['bad', ref]);
          return { success: true, output: stdout };
        }
        case 'run': {
          if (!command) return { success: false, output: '', error: 'command required' };
          const { stdout, exitCode } = await gitBisect(['run', 'sh', '-c', command]);
          return { success: exitCode === 0, output: stdout };
        }
        case 'status': {
          const { stdout } = await gitBisect(['status']);
          return { success: true, output: stdout || 'No bisect in progress' };
        }
        case 'reset': {
          const { stdout } = await gitBisect(['reset']);
          return { success: true, output: stdout || 'Bisect reset' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Git bisect failed: ${e}` };
    }
  },
};
