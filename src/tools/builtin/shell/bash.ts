import type { ToolInstance, ToolContext, ToolResult } from '../../../types/tools.ts';

const DEFAULT_TIMEOUT = 30_000;

export const bashTool: ToolInstance = {
  name: 'bash',
  description: 'Execute a shell command with timeout',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      workdir: { type: 'string', description: 'Working directory (defaults to workspace root)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
    },
    required: ['command'],
  },
  riskLevel: 'execute',
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const command = String(params['command'] ?? '');
    const workdir = String(params['workdir'] ?? ctx.workspaceRoot);
    const timeout = Number(params['timeout']) || DEFAULT_TIMEOUT;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell' : 'bash';
      const shellArgs = isWin ? ['-Command', command] : ['-c', command];

      const proc = Bun.spawn([shell, ...shellArgs], {
        cwd: workdir,
        stdout: 'pipe',
        stderr: 'pipe',
        signal: controller.signal,
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      const output = [stdout, stderr].filter(Boolean).join('\n').slice(0, 32000);

      return {
        success: exitCode === 0,
        output: output || `(exit code: ${exitCode})`,
        error: exitCode !== 0 ? stderr.slice(0, 2000) : undefined,
        metadata: { exitCode, command, workdir },
      };
    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      return {
        success: false,
        output: '',
        error: isAbort ? `Command timed out after ${timeout}ms` : `Command failed: ${e}`,
        metadata: { command, workdir, timedOut: isAbort },
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
