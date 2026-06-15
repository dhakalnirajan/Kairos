import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SECRET_PATTERNS = [
  { name: 'API Key', pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]([^'"]{8,})['"]/gi, severity: 'high' as const },
  { name: 'Secret', pattern: /(?:secret|token|password|passwd|pwd)\s*[=:]\s*['"]([^'"]{8,})['"]/gi, severity: 'high' as const },
  { name: 'Private Key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, severity: 'critical' as const },
  { name: 'AWS Key', pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, severity: 'critical' as const },
  { name: 'JWT', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'medium' as const },
  { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^'"]{10,}/gi, severity: 'high' as const },
];

export const secretRotationTool: ToolInstance = {
  name: 'secret_rotation',
  description: 'Secret rotation assistant: detect hardcoded secrets, generate rotation plans, validate .env files, check .gitignore',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['scan', 'rotation_plan', 'validate_env', 'check_gitignore', 'mask'], description: 'Rotation action' },
      path: { type: 'string', description: 'File or directory to scan' },
      secret: { type: 'string', description: 'Secret to mask/rotate' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      const { readdirSync } = require('fs');

      function scanForSecrets(dir: string, depth = 0): Array<{ file: string; line: number; type: string; severity: string; masked: string }> {
        const findings: Array<{ file: string; line: number; type: string; severity: string; masked: string }> = [];
        if (depth > 5) return findings;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
              findings.push(...scanForSecrets(full, depth + 1));
            } else if (entry.isFile() && /\.(ts|js|json|env|yaml|yml|toml|cfg|ini|conf)$/i.test(entry.name)) {
              try {
                const content = readFileSync(full, 'utf-8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  for (const pat of SECRET_PATTERNS) {
                    pat.pattern.lastIndex = 0;
                    if (pat.pattern.test(lines[i]!)) {
                      findings.push({
                        file: full.replace(ctx.workspaceRoot + '/', ''),
                        line: i + 1,
                        type: pat.name,
                        severity: pat.severity,
                        masked: lines[i]!.replace(/(['"])[^'"]{4}[^'"]*(['"])/g, '$1****$2'),
                      });
                    }
                  }
                }
              } catch {}
            }
          }
        } catch {}
        return findings;
      }

      switch (action) {
        case 'scan': {
          const targetPath = String(params['path'] ?? ctx.workspaceRoot);
          const findings = scanForSecrets(targetPath);
          const output = findings.length > 0
            ? findings.map((f) => `[${f.severity.toUpperCase()}] ${f.file}:${f.line} — ${f.type}\n  ${f.masked}`).join('\n')
            : 'No hardcoded secrets detected';
          return { success: findings.length === 0, output, metadata: { findings: findings.length } };
        }
        case 'rotation_plan': {
          const findings = scanForSecrets(ctx.workspaceRoot);
          const plan = findings.map((f, i) => `${i + 1}. Rotate ${f.type} in ${f.file}:${f.line}\n   Action: Replace with environment variable reference`).join('\n\n');
          return { success: true, output: plan || 'No secrets to rotate', metadata: { count: findings.length } };
        }
        case 'validate_env': {
          const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
          const results: string[] = [];
          for (const envFile of envFiles) {
            const envPath = join(ctx.workspaceRoot, envFile);
            if (existsSync(envPath)) {
              const content = readFileSync(envPath, 'utf-8');
              const lines = content.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
              const empty = lines.filter((l) => !l.includes('=') || l.endsWith('='));
              results.push(`${envFile}: ${lines.length} vars${empty.length > 0 ? ` (${empty.length} empty)` : ''}`);
            }
          }
          return { success: true, output: results.join('\n') || 'No .env files found' };
        }
        case 'check_gitignore': {
          const gitignorePath = join(ctx.workspaceRoot, '.gitignore');
          if (!existsSync(gitignorePath)) return { success: false, output: '', error: 'No .gitignore found' };
          const content = readFileSync(gitignorePath, 'utf-8');
          const important = ['.env', 'node_modules', 'dist', '*.log', '.kairos'];
          const missing = important.filter((pattern) => !content.includes(pattern));
          return {
            success: missing.length === 0,
            output: missing.length > 0
              ? `.gitignore missing entries:\n${missing.map((m) => `  ⚠ ${m}`).join('\n')}`
              : '.gitignore covers all important patterns',
            metadata: { missing },
          };
        }
        case 'mask': {
          const secret = String(params['secret'] ?? '');
          if (!secret) return { success: false, output: '', error: 'secret required' };
          const masked = secret.slice(0, 4) + '*'.repeat(Math.max(0, secret.length - 8)) + secret.slice(-4);
          return { success: true, output: `Masked: ${masked}` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Secret rotation failed: ${e}` };
    }
  },
};
