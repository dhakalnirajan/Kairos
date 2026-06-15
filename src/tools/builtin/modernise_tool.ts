import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const MODERNISATION_RULES: Array<{ pattern: RegExp; replacement: string; description: string }> = [
  { pattern: /\bvar\b/g, replacement: 'const', description: 'var → const (or let if reassigned)' },
  { pattern: /\.then\(\((\w+)\)\s*=>\s*\{/g, replacement: 'async/await (manual review needed)', description: '.then() chains → async/await' },
  { pattern: /function\s*\*?\s*\w+\s*\([^)]*\)\s*\{/g, replacement: 'arrow function candidate', description: 'Function declarations → arrow functions' },
  { pattern: /typeof\s+(\w+)\s*===?\s*['"]undefined['"]/g, replacement: '$1 === undefined', description: 'typeof check → direct comparison' },
  { pattern: /!\s*(\w+)\s*\|\|\s*(\w+)/g, replacement: '$1 ?? $2', description: '|| fallback → ?? nullish coalescing' },
  { pattern: /JSON\.parse\(JSON\.stringify\(([^)]+)\)\)/g, replacement: 'structuredClone($1)', description: 'JSON clone → structuredClone' },
  { pattern: /Object\.assign\(\{\},\s*([^)]+)\)/g, replacement: '{ ...$1 }', description: 'Object.assign → spread' },
  { pattern: /Array\.from\(([^)]+)\)/g, replacement: '[...$1]', description: 'Array.from → spread' },
];

export const moderniseTool: ToolInstance = {
  name: 'modernise',
  description: 'Legacy code modernisation: detect outdated patterns, suggest modern replacements, auto-fix common issues',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['scan', 'fix', 'report', 'list_rules'], description: 'Modernise action' },
      path: { type: 'string', description: 'File or directory to scan' },
      rule: { type: 'string', description: 'Specific rule to apply' },
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
        case 'list_rules': {
          const rules = MODERNISATION_RULES.map((r, i) => `${i + 1}. ${r.description}`);
          return { success: true, output: rules.join('\n'), metadata: { count: rules.length } };
        }
        case 'scan':
        case 'report': {
          const targetPath = String(params['path'] ?? ctx.workspaceRoot);
          const files: string[] = [];

          if (existsSync(targetPath)) {
            const stat = require('fs').statSync(targetPath);
            if (stat.isFile()) {
              files.push(targetPath);
            } else {
              const { readdirSync } = require('fs');
              const walk = (dir: string) => {
                for (const entry of readdirSync(dir, { withFileTypes: true })) {
                  const full = join(dir, entry.name);
                  if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) walk(full);
                  else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
                }
              };
              walk(targetPath);
            }
          }

          const findings: Array<{ file: string; line: number; rule: string; suggestion: string }> = [];

          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                for (const rule of MODERNISATION_RULES) {
                  if (rule.pattern.test(line)) {
                    findings.push({
                      file: file.replace(ctx.workspaceRoot + '/', ''),
                      line: i + 1,
                      rule: rule.description,
                      suggestion: rule.replacement,
                    });
                  }
                  rule.pattern.lastIndex = 0;
                }
              }
            } catch {}
          }

          const output = findings.length > 0
            ? findings.map((f) => `${f.file}:${f.line} — ${f.rule} → ${f.suggestion}`).join('\n')
            : 'No legacy patterns found';

          return { success: true, output, metadata: { findings: findings.length, files: files.length } };
        }
        case 'fix': {
          const targetPath = String(params['path'] ?? '');
          if (!targetPath || !existsSync(targetPath)) return { success: false, output: '', error: 'path required' };
          const ruleName = String(params['rule'] ?? '');
          const dryRun = params.dry_run === true;

          const content = readFileSync(targetPath, 'utf-8');
          let newContent = content;
          let changeCount = 0;

          for (const rule of MODERNISATION_RULES) {
            if (ruleName && !rule.description.includes(ruleName)) continue;
            const before = newContent;
            newContent = newContent.replace(rule.pattern, rule.replacement);
            if (newContent !== before) changeCount++;
          }

          if (!dryRun && newContent !== content) {
            writeFileSync(targetPath, newContent);
          }

          return {
            success: true,
            output: `${dryRun ? 'Preview' : 'Applied'} ${changeCount} transformations to ${targetPath.replace(ctx.workspaceRoot + '/', '')}`,
            metadata: { changes: changeCount, dryRun },
          };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Modernisation failed: ${e}` };
    }
  },
};
