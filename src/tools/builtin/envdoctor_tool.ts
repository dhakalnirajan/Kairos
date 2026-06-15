import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { existsSync } from 'fs';

export const envDoctorTool: ToolInstance = {
  name: 'env_doctor',
  description: 'Environment diagnostics: check runtime versions, dependencies, config health, path accessibility',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['check_all', 'runtime', 'dependencies', 'config', 'paths', 'permissions'], description: 'Diagnostic action' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const checks: string[] = [];
    const issues: string[] = [];

    try {
      const addCheck = (name: string, ok: boolean, detail: string) => {
        checks.push(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
        if (!ok) issues.push(`${name}: ${detail}`);
      };

      if (action === 'check_all' || action === 'runtime') {
        addCheck('Node.js', typeof process.version === 'string', process.version);
        addCheck('Bun', typeof Bun.version === 'string', Bun.version);
        addCheck('Platform', true, `${process.platform} ${process.arch}`);
        addCheck('CWD', true, process.cwd());
      }

      if (action === 'check_all' || action === 'dependencies') {
        const deps = ['neo-blessed', 'zod', 'openai', '@anthropic-ai/sdk'];
        for (const dep of deps) {
          const installed = existsSync(`node_modules/${dep}`);
          addCheck(`dep:${dep}`, installed, installed ? 'installed' : 'MISSING');
        }
      }

      if (action === 'check_all' || action === 'config') {
        const configPath = `${process.env.HOME || process.env.USERPROFILE}/AppData/Local/Kairos/config.json`;
        const configExists = existsSync(configPath);
        addCheck('config.json', configExists, configExists ? 'found' : 'not found (run setup first)');
      }

      if (action === 'check_all' || action === 'paths') {
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const kairosDir = `${home}/AppData/Local/Kairos`;
        addCheck('Kairos dir', existsSync(kairosDir), kairosDir);
      }

      if (action === 'check_all' || action === 'permissions') {
        try {
          await Bun.write(`${ctx.workspaceRoot}/.kairos-doctor-test`, 'test');
          const { unlinkSync } = await import('fs');
          unlinkSync(`${ctx.workspaceRoot}/.kairos-doctor-test`);
          addCheck('Write access', true, 'writable');
        } catch {
          addCheck('Write access', false, 'NOT WRITABLE');
        }
      }

      const output = [
        'Environment Diagnostics',
        '='.repeat(40),
        ...checks,
        '',
        issues.length > 0 ? `Issues found: ${issues.length}` : 'All checks passed',
      ].join('\n');

      return { success: issues.length === 0, output, metadata: { checks: checks.length, issues: issues.length } };
    } catch (e) {
      return { success: false, output: '', error: `Environment check failed: ${e}` };
    }
  },
};
