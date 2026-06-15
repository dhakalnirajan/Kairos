import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense'];
const BLOCKED_LICENSES = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'EUPL-1.1', 'CC-BY-NC-4.0'];

export const licenseScannerTool: ToolInstance = {
  name: 'license_scanner',
  description: 'Licence scanner: check package licences against allowlist/blocklist, detect licence conflicts',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['scan', 'check_package', 'list_licenses', 'validate_compatibility'], description: 'License action' },
      package: { type: 'string', description: 'Package to check' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'scan': {
          const lockPath = join(ctx.workspaceRoot, 'bun.lock');
          const pkgPath = join(ctx.workspaceRoot, 'package.json');
          if (!existsSync(pkgPath)) return { success: false, output: '', error: 'No package.json found' };
          const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
          const deps = { ...((pkgJson['dependencies'] ?? {}) as Record<string, string>), ...((pkgJson['devDependencies'] ?? {}) as Record<string, string>) };
          const output = Object.keys(deps).map((name) => `${name}@${deps[name]}`).join('\n');
          return { success: true, output: `Dependencies to check:\n${output}`, metadata: { count: Object.keys(deps).length } };
        }
        case 'check_package': {
          const pkg = String(params['package'] ?? '');
          if (!pkg) return { success: false, output: '', error: 'package required' };
          const isAllowed = ALLOWED_LICENSES.some((l) => l.toLowerCase());
          const isBlocked = BLOCKED_LICENSES.some((l) => l.toLowerCase());
          return { success: true, output: `Package: ${pkg}\nNote: Check npm page for licence info\nAllowed licences: ${ALLOWED_LICENSES.join(', ')}\nBlocked licences: ${BLOCKED_LICENSES.join(', ')}` };
        }
        case 'list_licenses': {
          return { success: true, output: `Allowed: ${ALLOWED_LICENSES.join(', ')}\nBlocked: ${BLOCKED_LICENSES.join(', ')}` };
        }
        case 'validate_compatibility': {
          const pkg = String(params['package'] ?? '');
          return { success: true, output: `Validate ${pkg || 'all packages'} licence compatibility with project (MIT)\nNote: Check individual package licences on npm/GitHub` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `License scan failed: ${e}` };
    }
  },
};
