import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const reproCaseTool: ToolInstance = {
  name: 'repro_case',
  description: 'Repro case generator: create minimal reproductions of bugs, build test fixtures, generate reproduction scripts',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['generate', 'from_error', 'from_diff', 'list'], description: 'Repro action' },
      title: { type: 'string', description: 'Repro case title' },
      description: { type: 'string', description: 'Bug description' },
      error: { type: 'string', description: 'Error message or stack trace' },
      code: { type: 'string', description: 'Relevant code snippet' },
      expected: { type: 'string', description: 'Expected behavior' },
      actual: { type: 'string', description: 'Actual behavior' },
      lang: { type: 'string', description: 'Language (ts, js, python)' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const reproDir = join(ctx.workspaceRoot, '.repro');

    try {
      if (!existsSync(reproDir)) mkdirSync(reproDir, { recursive: true });

      switch (action) {
        case 'generate': {
          const title = String(params['title'] ?? `bug-${Date.now()}`);
          const description = String(params['description'] ?? '');
          const code = String(params['code'] ?? '');
          const expected = String(params['expected'] ?? '');
          const actual = String(params['actual'] ?? '');
          const lang = String(params['lang'] ?? 'ts');
          const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

          const reproCode = lang === 'python'
            ? `"""${title}\n\n${description}\n\nExpected: ${expected}\nActual: ${actual}\n"""\n\n${code || '# TODO: Add reproduction code'}\n\nif __name__ == "__main__":\n    print("Reproduction case for: ${title}")\n`
            : `// ${title}\n// ${description}\n//\n// Expected: ${expected}\n// Actual: ${actual}\n\n${code || '// TODO: Add reproduction code'}\n\nconsole.log("Reproduction case for: ${title}");\n`;

          const filePath = join(reproDir, `${filename}.${lang === 'python' ? 'py' : 'ts'}`);
          writeFileSync(filePath, reproCode);

          const readme = `# ${title}\n\n## Description\n${description}\n\n## Expected\n${expected}\n\n## Actual\n${actual}\n\n## Reproduction\nRun: \`bun run ${filePath.replace(ctx.workspaceRoot + '/', '')}\`\n`;
          writeFileSync(join(reproDir, `${filename}.md`), readme);

          return { success: true, output: `Created repro case: ${filePath.replace(ctx.workspaceRoot + '/', '')}`, metadata: { file: filePath } };
        }
        case 'from_error': {
          const error = String(params['error'] ?? '');
          if (!error) return { success: false, output: '', error: 'error required' };
          const title = error.split('\n')[0]?.slice(0, 80) ?? 'unknown-error';
          const filename = `error-${Date.now()}`;

          const reproCode = `// Reproduction case for error\n// Error: ${title}\n\nconst error = ${JSON.stringify(error)};\n\nconsole.error("Reproducing error:");\nconsole.error(error);\n`;
          writeFileSync(join(reproDir, `${filename}.ts`), reproCode);

          return { success: true, output: `Created error repro: .repro/${filename}.ts` };
        }
        case 'from_diff': {
          const code = String(params['code'] ?? '');
          if (!code) return { success: false, output: '', error: 'code (diff) required' };
          const filename = `diff-${Date.now()}`;
          writeFileSync(join(reproDir, `${filename}.diff`), code);
          return { success: true, output: `Saved diff: .repro/${filename}.diff` };
        }
        case 'list': {
          const { readdirSync } = require('fs');
          try {
            const files = readdirSync(reproDir).filter((f: string) => !f.startsWith('.'));
            return { success: true, output: files.join('\n') || 'No repro cases', metadata: { count: files.length } };
          } catch {
            return { success: true, output: 'No repro cases' };
          }
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Repro case generation failed: ${e}` };
    }
  },
};
