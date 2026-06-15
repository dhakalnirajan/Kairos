import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const LANGUAGE_MAP: Record<string, { ext: string; transform: (code: string) => string }> = {
  'js-to-ts': {
    ext: '.ts',
    transform: (code) => code
      .replace(/\/\/\s*@ts-check/g, '')
      .replace(/\/\*\* @type \{[^}]+\}\*\//g, '')
      .replace(/\bconst\b/g, 'const')
      .replace(/\blet\b/g, 'let')
      .replace(/:\s*any\b/g, ': unknown'),
  },
  'ts-to-js': {
    ext: '.js',
    transform: (code) => code
      .replace(/:\s*(string|number|boolean|void|never|any|unknown|Record<[^>]+>|Array<[^>]+>|\[\])\b/g, '')
      .replace(/interface\s+\w+\s*\{[^}]*\}/g, '')
      .replace(/type\s+\w+\s*=[^;]+;/g, '')
      .replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\n?/g, '')
      .replace(/<[^>]+>/g, ''),
  },
  'var-to-const': {
    ext: '',
    transform: (code) => code.replace(/\bvar\b/g, 'const'),
  },
  'require-to-import': {
    ext: '',
    transform: (code) => code
      .replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/g, 'import $1 from \'$2\'')
      .replace(/const\s*\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)/g, 'import { $1 } from \'$2\''),
  },
  'callbacks-to-async': {
    ext: '',
    transform: (code) => code
      .replace(/\.then\(\(([^)]*)\)\s*=>\s*\{/g, '/* converted to async */\n  const result = /* await */;')
      .replace(/callback\(null,\s*([^)]+)\)/g, 'resolve($1)')
      .replace(/callback\(([^)]+)\)/g, 'reject($1)'),
  },
};

export const transpilerTool: ToolInstance = {
  name: 'transpile',
  description: 'Code transpilation: convert between JS/TS, modernise var->const, require->import, callbacks->async',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['transpile', 'list_transforms', 'preview'], description: 'Transpile action' },
      transform: { type: 'string', description: 'Transform name (js-to-ts, ts-to-js, var-to-const, require-to-import, callbacks-to-async)' },
      path: { type: 'string', description: 'File or directory to transpile' },
      dry_run: { type: 'boolean', description: 'Preview without writing' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'list_transforms': {
          const transforms = Object.keys(LANGUAGE_MAP).map((name) => {
            const t = LANGUAGE_MAP[name]!;
            return `${name}: transforms code${t.ext ? ` (output: ${t.ext})` : ''}`;
          });
          return { success: true, output: transforms.join('\n'), metadata: { count: transforms.length } };
        }
        case 'preview':
        case 'transpile': {
          const transformName = String(params['transform'] ?? '');
          if (!transformName) return { success: false, output: '', error: 'transform required' };
          const transformer = LANGUAGE_MAP[transformName];
          if (!transformer) return { success: false, output: '', error: `Unknown transform: ${transformName}. Available: ${Object.keys(LANGUAGE_MAP).join(', ')}` };

          const targetPath = String(params['path'] ?? ctx.workspaceRoot);
          const dryRun = params.dry_run === true || action === 'preview';

          if (!existsSync(targetPath)) return { success: false, output: '', error: `Path not found: ${targetPath}` };

          const stat = require('fs').statSync(targetPath);
          const files: string[] = [];

          if (stat.isFile()) {
            files.push(targetPath);
          } else {
            const { readdirSync } = require('fs');
            const walk = (dir: string) => {
              for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const full = join(dir, entry.name);
                if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') walk(full);
                else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx'))) {
                  files.push(full);
                }
              }
            };
            walk(targetPath);
          }

          let transformed = 0;
          const results: string[] = [];

          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const newContent = transformer.transform(content);
              if (newContent !== content) {
                transformed++;
                const outFile = transformer.ext ? file.replace(/\.[^.]+$/, transformer.ext) : file;
                if (!dryRun) {
                  writeFileSync(outFile, newContent);
                }
                results.push(`${dryRun ? '[preview] ' : ''}${file.replace(ctx.workspaceRoot + '/', '')} → ${outFile.replace(ctx.workspaceRoot + '/', '')}`);
              }
            } catch {}
          }

          return {
            success: true,
            output: `${dryRun ? 'Preview' : 'Transpiled'} ${transformed}/${files.length} files\n${results.join('\n') || 'No changes needed'}`,
            metadata: { transformed, total: files.length, dryRun },
          };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Transpiler failed: ${e}` };
    }
  },
};
