import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export const changelogTool: ToolInstance = {
  name: 'changelog',
  description: 'Changelog generation: Keep a Changelog format, breaking change highlighting, version tagging',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['generate', 'since_tag', 'breaking_changes'], description: 'Changelog action' },
      from_tag: { type: 'string', description: 'Start tag' },
      version: { type: 'string', description: 'Version for changelog header' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      let gitArgs: string[];
      switch (action) {
        case 'generate': {
          gitArgs = ['git', 'log', '--oneline', '--no-merges', '-50'];
          break;
        }
        case 'since_tag': {
          const tag = String(params['from_tag'] ?? '');
          if (!tag) return { success: false, output: '', error: 'from_tag required' };
          gitArgs = ['git', 'log', '--oneline', '--no-merges', `${tag}..HEAD`];
          break;
        }
        case 'breaking_changes': {
          gitArgs = ['git', 'log', '--oneline', '--no-merges', '-50'];
          break;
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }

      const proc = Bun.spawn(gitArgs, { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) return { success: false, output: '', error: 'Failed to read git log' };

      const lines = stdout.trim().split('\n').filter((l) => l.trim());
      const version = String(params['version'] ?? 'Unreleased');
      const added: string[] = [];
      const fixed: string[] = [];
      const removed: string[] = [];
      const changed: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\w+\s+(feat|fix|docs|chore|refactor|test|perf|build|ci|style|breaking)[:(\s]/i);
        if (match) {
          const type = match[1]!.toLowerCase();
          const clean = line.replace(/^\w+\s+/, '');
          if (type === 'feat') added.push(clean);
          else if (type === 'fix') fixed.push(clean);
          else if (type === 'breaking') removed.push(clean);
          else changed.push(clean);
        } else {
          changed.push(line.replace(/^\w+\s+/, ''));
        }
      }

      const output = [
        `# Changelog`,
        '',
        `## [${version}] - ${new Date().toISOString().split('T')[0]}`,
        '',
        added.length > 0 ? `### Added\n${added.map((i) => `- ${i}`).join('\n')}` : '',
        changed.length > 0 ? `### Changed\n${changed.map((i) => `- ${i}`).join('\n')}` : '',
        fixed.length > 0 ? `### Fixed\n${fixed.map((i) => `- ${i}`).join('\n')}` : '',
        removed.length > 0 ? `### Removed\n${removed.map((i) => `- ${i}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');

      return { success: true, output };
    } catch (e) {
      return { success: false, output: '', error: `Changelog failed: ${e}` };
    }
  },
};
