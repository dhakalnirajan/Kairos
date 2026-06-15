import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface ReviewComment {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion' | 'nit';
  category: string;
  message: string;
}

const REVIEW_PATTERNS: Array<{ pattern: RegExp; severity: ReviewComment['severity']; category: string; message: string }> = [
  { pattern: /:\s*any\b/g, severity: 'warning', category: 'type-safety', message: 'Use `unknown` instead of `any`' },
  { pattern: /console\.(log|debug)\(/g, severity: 'nit', category: 'logging', message: 'Remove debug logging' },
  { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'suggestion', category: 'maintenance', message: 'Resolve TODO/FIXME' },
  { pattern: /catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g, severity: 'warning', category: 'error-handling', message: 'Empty catch block swallows errors' },
  { pattern: /new\s+RegExp\([^)]+\)/g, severity: 'suggestion', category: 'security', message: 'Dynamic RegExp may be vulnerable to ReDoS' },
  { pattern: /eval\(/g, severity: 'error', category: 'security', message: 'eval() is a security risk' },
  { pattern: /var\s+/g, severity: 'warning', category: 'modernisation', message: 'Use const/let instead of var' },
  { pattern: /===?\s*['"]undefined['"]/g, severity: 'nit', category: 'modernisation', message: 'Use typeof check or optional chaining' },
  { pattern: /Math\.random\(\)/g, severity: 'suggestion', category: 'security', message: 'Math.random() is not cryptographically secure' },
  { pattern: /process\.exit\(/g, severity: 'warning', category: 'robustness', message: 'process.exit() prevents cleanup; throw instead' },
];

export const pairProgrammingTool: ToolInstance = {
  name: 'pair_programming',
  description: 'Pair-programming shadow mode: real-time code review, style checks, architecture suggestions, rubber duck debugging',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['review', 'suggest', 'explain', 'rubber_duck', 'style_check'], description: 'Pair programming action' },
      path: { type: 'string', description: 'File to review' },
      code: { type: 'string', description: 'Code snippet to review' },
      question: { type: 'string', description: 'Question for rubber duck debugging' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'review': {
          const targetPath = String(params['path'] ?? '');
          const code = String(params['code'] ?? '');
          let content = code;
          let filePath = targetPath;

          if (!content && targetPath) {
            const resolved = existsSync(targetPath) ? targetPath : join(ctx.workspaceRoot, targetPath);
            if (existsSync(resolved)) {
              content = readFileSync(resolved, 'utf-8');
              filePath = resolved.replace(ctx.workspaceRoot + '/', '');
            }
          }
          if (!content) return { success: false, output: '', error: 'No code to review' };

          const comments: ReviewComment[] = [];
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            for (const rule of REVIEW_PATTERNS) {
              rule.pattern.lastIndex = 0;
              if (rule.pattern.test(lines[i]!)) {
                comments.push({ file: filePath, line: i + 1, severity: rule.severity, category: rule.category, message: rule.message });
              }
            }
          }

          const output = comments.length > 0
            ? comments.map((c) => `${c.severity.toUpperCase().padEnd(10)} ${c.file}:${c.line} — [${c.category}] ${c.message}`).join('\n')
            : 'No issues found — code looks good!';
          return { success: true, output, metadata: { comments: comments.length } };
        }
        case 'suggest': {
          const code = String(params['code'] ?? '');
          if (!code) return { success: false, output: '', error: 'code required' };
          const suggestions: string[] = [];
          if (code.includes('function') && !code.includes('=>')) suggestions.push('Consider using arrow functions for shorter syntax');
          if (code.includes('.then(')) suggestions.push('Consider using async/await instead of .then() chains');
          if (code.includes('JSON.parse')) suggestions.push('Add try/catch around JSON.parse for safety');
          if (code.length > 500) suggestions.push('Function is very long — consider breaking it into smaller functions');
          return { success: true, output: suggestions.length > 0 ? suggestions.map((s) => `💡 ${s}`).join('\n') : 'No suggestions — code is well-structured' };
        }
        case 'explain': {
          const code = String(params['code'] ?? '');
          if (!code) return { success: false, output: '', error: 'code required' };
          const patterns: string[] = [];
          if (/\basync\b/.test(code)) patterns.push('uses async/await');
          if (/\bclass\b/.test(code)) patterns.push('defines a class');
          if (/\bfunction\b/.test(code) || /=\s*\(/.test(code)) patterns.push('defines a function');
          if (/\bimport\b/.test(code)) patterns.push('imports modules');
          if (/=>/.test(code)) patterns.push('uses arrow functions');
          if (/\bnew\b/.test(code)) patterns.push('instantiates objects');
          if (/\bmap\b|\bfilter\b|\breduce\b/.test(code)) patterns.push('uses array methods');
          return { success: true, output: `Code analysis:\n${patterns.map((p) => `• ${p}`).join('\n') || '• Simple code block'}` };
        }
        case 'rubber_duck': {
          const question = String(params['question'] ?? '');
          if (!question) return { success: false, output: '', error: 'question required' };
          const steps = [
            '1. What is the expected behavior?',
            '2. What is actually happening?',
            '3. When did it last work correctly?',
            '4. What changed recently?',
            '5. Have you checked the error message carefully?',
            '6. Can you reproduce it consistently?',
            '7. What have you already tried?',
          ];
          return { success: true, output: `🦆 Rubber Duck Debugging\n\nYour question: "${question}"\n\nTry working through these steps:\n${steps.join('\n')}\n\nOften, just explaining the problem aloud (or to a duck) reveals the answer.` };
        }
        case 'style_check': {
          const code = String(params['code'] ?? '');
          if (!code) return { success: false, output: '', error: 'code required' };
          const issues: string[] = [];
          const lines = code.split('\n');
          if (lines.length > 50) issues.push(`File is ${lines.length} lines — consider splitting`);
          const longLines = lines.filter((l) => l.length > 120);
          if (longLines.length > 0) issues.push(`${longLines.length} lines exceed 120 characters`);
          if (/\t/.test(code) && /  /.test(code)) issues.push('Mixed tabs and spaces');
          return { success: true, output: issues.length > 0 ? issues.map((i) => `⚠ ${i}`).join('\n') : 'Style checks passed' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Pair programming failed: ${e}` };
    }
  },
};
