import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const QUERY_PATTERNS: Array<{ pattern: RegExp; issue: string; suggestion: string }> = [
  { pattern: /SELECT\s+\*\s+FROM/gi, issue: 'SELECT * usage', suggestion: 'Select specific columns to reduce memory and improve index usage' },
  { pattern: /WHERE\s+\w+\s+LIKE\s+['"]%/gi, issue: 'Leading wildcard in LIKE', suggestion: 'Leading wildcard prevents index usage; consider full-text search' },
  { pattern: /JOIN.*ON.*!=/gi, issue: 'Non-equi JOIN', suggestion: 'Non-equi joins are slow; consider restructuring the query' },
  { pattern: /ORDER BY.*RANDOM\(\)/gi, issue: 'ORDER BY RANDOM()', suggestion: 'Very slow on large tables; use a pre-computed random column' },
  { pattern: /COUNT\(\*\)\s+FROM/gi, issue: 'COUNT(*) full scan', suggestion: 'Consider caching or approximate counts for large tables' },
  { pattern: /IN\s*\(\s*SELECT/gi, issue: 'Subquery in IN clause', suggestion: 'Replace with JOIN or EXISTS for better performance' },
  { pattern: /NOT\s+EXISTS\s*\(\s*SELECT/gi, issue: 'NOT EXISTS subquery', suggestion: 'Ensure correlated subquery is indexed' },
  { pattern: /GROUP BY.*HAVING.*COUNT/gi, issue: 'HAVING COUNT pattern', suggestion: 'Consider materialized views for frequent aggregations' },
];

const JS_QUERY_PATTERNS: Array<{ pattern: RegExp; issue: string; suggestion: string }> = [
  { pattern: /\.forEach\(/g, issue: 'forEach usage', suggestion: 'for...of is faster and supports async/await' },
  { pattern: /new\s+RegExp\([^)]+\)/g, issue: 'Dynamic RegExp', suggestion: 'Cache compiled RegExp to avoid recompilation' },
  { pattern: /\.filter\(\)\.map\(\)/g, issue: 'Filter then map', suggestion: 'Use reduce() to combine into single pass' },
  { pattern: /\+\=\s*['"]|['"]\s*\+/g, issue: 'String concatenation', suggestion: 'Use template literals for readability and performance' },
  { pattern: /JSON\.parse\(JSON\.stringify/g, issue: 'JSON clone', suggestion: 'Use structuredClone() or spread operator' },
];

export const queryOptTool: ToolInstance = {
  name: 'query_optimisation',
  description: 'Query optimisation engine: detect slow query patterns, suggest indexes, profile code hotspots, optimise data access',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['scan_queries', 'scan_js', 'suggest_indexes', 'profile_hotspots'], description: 'Optimisation action' },
      path: { type: 'string', description: 'File or directory to scan' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      const { readdirSync } = require('fs');
      const targetPath = String(params['path'] ?? ctx.workspaceRoot);
      const files: string[] = [];

      const walk = (dir: string, depth = 0) => {
        if (depth > 4) return;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) walk(full, depth + 1);
            else if (entry.isFile() && /\.(ts|js|sql|py)$/.test(entry.name)) files.push(full);
          }
        } catch {}
      };
      walk(targetPath);

      switch (action) {
        case 'scan_queries': {
          const findings: Array<{ file: string; line: number; issue: string; suggestion: string }> = [];
          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                for (const rule of QUERY_PATTERNS) {
                  if (rule.pattern.test(lines[i]!)) {
                    findings.push({ file: file.replace(ctx.workspaceRoot + '/', ''), line: i + 1, issue: rule.issue, suggestion: rule.suggestion });
                  }
                  rule.pattern.lastIndex = 0;
                }
              }
            } catch {}
          }
          const output = findings.map((f) => `${f.file}:${f.line} — ${f.issue}\n  → ${f.suggestion}`).join('\n\n');
          return { success: true, output: output || 'No query optimisation issues found', metadata: { findings: findings.length } };
        }
        case 'scan_js': {
          const findings: Array<{ file: string; line: number; issue: string; suggestion: string }> = [];
          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                for (const rule of JS_QUERY_PATTERNS) {
                  if (rule.pattern.test(lines[i]!)) {
                    findings.push({ file: file.replace(ctx.workspaceRoot + '/', ''), line: i + 1, issue: rule.issue, suggestion: rule.suggestion });
                  }
                  rule.pattern.lastIndex = 0;
                }
              }
            } catch {}
          }
          const output = findings.map((f) => `${f.file}:${f.line} — ${f.issue}\n  → ${f.suggestion}`).join('\n\n');
          return { success: true, output: output || 'No JS optimisation issues found', metadata: { findings: findings.length } };
        }
        case 'suggest_indexes': {
          const findings: string[] = [];
          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const whereMatches = content.matchAll(/WHERE\s+(\w+)\s*=/gi);
              const joins = content.matchAll(/JOIN\s+\w+\s+ON\s+(\w+\.\w+)\s*=/gi);
              for (const m of whereMatches) findings.push(`Consider index on column: ${m[1]}`);
              for (const m of joins) findings.push(`Consider index on join column: ${m[1]}`);
            } catch {}
          }
          const unique = [...new Set(findings)];
          return { success: true, output: unique.length > 0 ? unique.map((f) => `📇 ${f}`).join('\n') : 'No index suggestions (no SQL patterns found)' };
        }
        case 'profile_hotspots': {
          const fileSizes = files.map((f) => {
            try {
              const content = readFileSync(f, 'utf-8');
              return { file: f.replace(ctx.workspaceRoot + '/', ''), lines: content.split('\n').length };
            } catch {
              return { file: f.replace(ctx.workspaceRoot + '/', ''), lines: 0 };
            }
          }).sort((a, b) => b.lines - a.lines);
          const output = fileSizes.slice(0, 15).map((f) => `${f.file.padEnd(40)} ${f.lines} lines`).join('\n');
          return { success: true, output: `Largest files (potential hotspots):\n${output}` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Query optimisation failed: ${e}` };
    }
  },
};
