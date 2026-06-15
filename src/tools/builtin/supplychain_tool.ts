import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const KNOWN_VULNERABLE_PACKAGES = new Map<string, string[]>([
  ['lodash', ['< 4.17.21 - Prototype Pollution']],
  ['minimist', ['< 1.2.6 - Prototype Pollution']],
  ['node-fetch', ['< 2.6.7 - Information Exposure', '< 3.0.0-beta.9 - Information Exposure']],
  ['axios', ['< 0.21.2 - SSRF', '< 1.6.0 - SSRF']],
  ['express', ['< 4.18.2 - Open Redirect']],
  ['jsonwebtoken', ['< 9.0.0 - Insecure defaults']],
  ['semver', ['< 7.5.2 - ReDoS']],
  ['tough-cookie', ['< 4.1.3 - Prototype Pollution']],
  ['xml2js', ['< 0.5.0 - Prototype Pollution']],
  ['ws', ['< 8.17.1 - DoS']],
]);

const LICENSE_COMPATIBILITY = new Map<string, string[]>([
  ['MIT', ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']],
  ['Apache-2.0', ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']],
  ['BSD-2-Clause', ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']],
  ['BSD-3-Clause', ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']],
  ['ISC', ['Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MIT']],
  ['GPL-3.0', ['GPL-3.0']],
  ['AGPL-3.0', ['AGPL-3.0']],
]);

export const supplyChainTool: ToolInstance = {
  name: 'supply_chain',
  description: 'Supply chain security: audit dependencies for vulnerabilities, license compatibility, outdated packages',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['audit', 'licenses', 'outdated', 'tree', 'check_vulns'], description: 'Audit action' },
      package: { type: 'string', description: 'Specific package to check' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const pkg = String(params['package'] ?? '');

    try {
      const pkgJsonPath = join(ctx.workspaceRoot, 'package.json');
      if (!existsSync(pkgJsonPath)) {
        return { success: false, output: '', error: 'No package.json found in workspace' };
      }

      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as Record<string, unknown>;
      const deps = (pkgJson['dependencies'] as Record<string, string> ?? {});
      const devDeps = (pkgJson['devDependencies'] as Record<string, string> ?? {});

      switch (action) {
        case 'audit': {
          const allDeps = { ...deps, ...devDeps };
          const findings: string[] = [];
          for (const [name, version] of Object.entries(allDeps)) {
            const vulns = KNOWN_VULNERABLE_PACKAGES.get(name);
            if (vulns) {
              findings.push(`⚠ ${name}@${version}: ${vulns.join('; ')}`);
            }
          }
          return {
            success: findings.length === 0,
            output: findings.length > 0 ? `Vulnerability findings:\n${findings.join('\n')}` : `Checked ${Object.keys(allDeps).length} dependencies - no known vulnerabilities`,
            metadata: { checked: Object.keys(allDeps).length, findings: findings.length },
          };
        }
        case 'check_vulns': {
          if (!pkg) return { success: false, output: '', error: 'package required' };
          const vulns = KNOWN_VULNERABLE_PACKAGES.get(pkg);
          return vulns
            ? { success: false, output: `Known vulnerabilities in ${pkg}:\n${vulns.join('\n')}` }
            : { success: true, output: `No known vulnerabilities for ${pkg}` };
        }
        case 'licenses': {
          const lockPath = join(ctx.workspaceRoot, 'bun.lock');
          const licenses = new Map<string, string>();
          if (existsSync(lockPath)) {
            try {
              const lockContent = readFileSync(lockPath, 'utf-8');
              const licenseMatches = lockContent.matchAll(/"license":\s*"([^"]+)"/g);
              for (const m of licenseMatches) licenses.set('dep', m[1]!);
            } catch {}
          }
          const allDeps = { ...deps, ...devDeps };
          const output = Object.keys(allDeps).map((name) => {
            const license = licenses.get(name) ?? 'unknown';
            return `${name}: ${license}`;
          }).join('\n');
          return { success: true, output, metadata: { count: Object.keys(allDeps).length } };
        }
        case 'outdated': {
          const allDeps = { ...deps, ...devDeps };
          const outdated: string[] = [];
          for (const [name, version] of Object.entries(allDeps)) {
            if (version.startsWith('^') || version.startsWith('~')) {
              outdated.push(`${name}: ${version} (has range constraint)`);
            } else if (version === '*') {
              outdated.push(`${name}: * (unconstrained - security risk)`);
            }
          }
          return {
            success: outdated.length === 0,
            output: outdated.length > 0 ? `Potentially outdated:\n${outdated.join('\n')}` : 'All dependencies have pinned versions',
            metadata: { count: outdated.length },
          };
        }
        case 'tree': {
          const allDeps = { ...deps, ...devDeps };
          const tree = Object.entries(allDeps).map(([name, version]) => `${name}@${version}`).join('\n');
          return { success: true, output: tree || 'No dependencies' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Supply chain audit failed: ${e}` };
    }
  },
};
