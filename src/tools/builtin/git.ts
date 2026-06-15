import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

type GitOperation = 'status' | 'diff' | 'log' | 'add' | 'commit' | 'branch' | 'show';

const READ_OPS: GitOperation[] = ['status', 'diff', 'log', 'branch', 'show'];

export const gitTool: ToolInstance = {
  name: 'git',
  description: 'Execute git operations (status, diff, log, add, commit, branch)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', description: 'Git operation to perform' },
      args: { type: 'array', items: { type: 'string' }, description: 'Additional arguments' },
    },
    required: ['operation'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const operation = String(params['operation'] ?? 'status') as GitOperation;
    const args = (params['args'] as string[] | undefined) ?? [];

    if (!['status', 'diff', 'log', 'add', 'commit', 'branch', 'show'].includes(operation)) {
      return { success: false, output: '', error: `Unknown git operation: ${operation}` };
    }

    const cmdArgs = ['git', operation, ...args];

    if (operation === 'commit') {
      const msgIdx = args.indexOf('-m');
      if (msgIdx === -1 || !args[msgIdx + 1]) {
        return { success: false, output: '', error: 'Commit requires -m with message' };
      }
    }

    try {
      const proc = Bun.spawn(cmdArgs, {
        cwd: ctx.workspaceRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return {
        success: exitCode === 0,
        output: stdout.slice(0, 16000) || stderr.slice(0, 4000),
        error: exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        metadata: { operation, args, exitCode },
      };
    } catch (e) {
      return { success: false, output: '', error: `Git command failed: ${e}` };
    }
  },
};
