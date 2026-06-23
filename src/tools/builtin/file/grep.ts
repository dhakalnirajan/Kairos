import { join } from 'path';
import { readdir } from 'fs/promises';
import { readFile } from 'fs/promises';
import type { ToolInstance, ToolContext, ToolResult } from '../../../types/tools.ts';

async function grepDir(
  dir: string,
  pattern: RegExp,
  root: string,
  include: string,
  results: Array<{ file: string; line: number; content: string }>,
  maxResults: number,
): Promise<void> {
  if (results.length >= maxResults) return;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      const fullPath = join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;

      if (entry.isFile()) {
        if (include && !matchInclude(entry.name, include)) continue;
        try {
          const content = await readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= maxResults) return;
            const line = lines[i] ?? '';
            if (pattern.test(line)) {
              results.push({
                file: fullPath.slice(root.length).replace(/\\/g, '/').replace(/^\//, ''),
                line: i + 1,
                content: line.trim().slice(0, 200),
              });
            }
          }
        } catch {
          // skip binary/inaccessible files
        }
      } else if (entry.isDirectory()) {
        await grepDir(fullPath, pattern, root, include, results, maxResults);
      }
    }
  } catch {
    // skip
  }
}

function matchInclude(filename: string, include: string): boolean {
  if (include.startsWith('*.')) {
    return filename.endsWith(include.slice(1));
  }
  return filename.includes(include);
}

export const grepTool: ToolInstance = {
  name: 'grep',
  description: 'Search file contents using regex patterns',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Directory to search in (defaults to workspace root)' },
      include: { type: 'string', description: 'File pattern to include (e.g. *.ts)' },
      maxResults: { type: 'number', description: 'Max results (default 100)' },
    },
    required: ['pattern'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    try {
      const patternStr = String(params['pattern'] ?? '');
      const searchDir = String(params['path'] ?? ctx.workspaceRoot);
      const include = String(params['include'] ?? '');
      const maxResults = Number(params['maxResults']) || 100;

      if (!patternStr) return { success: false, output: '', error: 'Pattern is required' };

      const pattern = new RegExp(patternStr, 'i');
      const results: Array<{ file: string; line: number; content: string }> = [];
      await grepDir(searchDir, pattern, searchDir, include, results, maxResults);

      const output = results.map((r) => `${r.file}:${r.line}: ${r.content}`).join('\n');
      return {
        success: true,
        output: output || 'No matches found',
        metadata: { count: results.length },
      };
    } catch (e) {
      return { success: false, output: '', error: `Grep failed: ${e}` };
    }
  },
};
