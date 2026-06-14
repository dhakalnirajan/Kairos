import { join } from 'path';
import { readdir } from 'fs/promises';
import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

async function globMatch(dir: string, pattern: string, results: string[], root: string): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relative = fullPath.slice(root.length).replace(/\\/g, '/').replace(/^\//, '');

      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

      if (entry.isFile()) {
        if (matchGlob(relative, pattern) || matchGlob(entry.name, pattern)) {
          results.push(fullPath);
        }
      } else if (entry.isDirectory()) {
        if (matchGlob(entry.name, pattern)) {
          results.push(fullPath);
        }
        await globMatch(fullPath, pattern, results, root);
      }
    }
  } catch {
    // skip inaccessible dirs
  }
}

function matchGlob(name: string, pattern: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`, 'i').test(name);
}

export const globTool: ToolInstance = {
  name: 'glob',
  description: 'Find files matching a glob pattern',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts, src/**/*.test.ts)' },
      path: { type: 'string', description: 'Directory to search in (defaults to workspace root)' },
    },
    required: ['pattern'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    try {
      const pattern = String(params['pattern'] ?? '');
      const searchDir = String(params['path'] ?? ctx.workspaceRoot);

      if (!pattern) return { success: false, output: '', error: 'Pattern is required' };

      const results: string[] = [];
      await globMatch(searchDir, pattern, results, searchDir);

      const limited = results.slice(0, 200);
      return {
        success: true,
        output: limited.length > 0 ? limited.join('\n') : 'No files found',
        metadata: { count: limited.length, total: results.length },
      };
    } catch (e) {
      return { success: false, output: '', error: `Glob failed: ${e}` };
    }
  },
};
