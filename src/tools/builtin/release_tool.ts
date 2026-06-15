import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export const releaseNotesTool: ToolInstance = {
  name: 'release_notes',
  description: 'Generate release notes from git log, categorise commits by type (feat/fix/chore/docs)',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['generate', 'since_tag', 'between_tags'], description: 'Action' },
      from_tag: { type: 'string', description: 'Start tag' },
      to_tag: { type: 'string', description: 'End tag (default HEAD)' },
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
        case 'between_tags': {
          const from = String(params['from_tag'] ?? '');
          const to = String(params['to_tag'] ?? 'HEAD');
          if (!from) return { success: false, output: '', error: 'from_tag required' };
          gitArgs = ['git', 'log', '--oneline', '--no-merges', `${from}..${to}`];
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
      const categories: Record<string, string[]> = { Features: [], Fixes: [], Documentation: [], Chores: [], Other: [] };

      for (const line of lines) {
        const match = line.match(/^\w+\s+(feat|fix|docs|chore|refactor|test|perf|build|ci|style)[:(\s]/i);
        if (match) {
          const type = match[1]!.toLowerCase();
          if (type === 'feat') categories.Features!.push(line);
          else if (type === 'fix') categories.Fixes!.push(line);
          else if (type === 'docs') categories.Documentation!.push(line);
          else categories.Chores!.push(line);
        } else {
          categories.Other!.push(line);
        }
      }

      const output = Object.entries(categories)
        .filter(([, items]) => items!.length > 0)
        .map(([category, items]) => `### ${category}\n${items!.map((i) => `- ${i.replace(/^\w+\s+/, '')}`).join('\n')}`)
        .join('\n\n');

      return { success: true, output: output || 'No commits found', metadata: { totalCommits: lines.length } };
    } catch (e) {
      return { success: false, output: '', error: `Release notes failed: ${e}` };
    }
  },
};
