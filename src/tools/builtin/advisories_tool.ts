import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { advisoryWatcher } from '../devops/advisories.ts';

export const advisoriesTool: ToolInstance = {
  name: 'advisories',
  description: 'Security advisory watcher: check packages for known vulnerabilities, track advisories',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['check_package', 'add', 'list', 'critical', 'checked_packages', 'clear'], description: 'Advisory action' },
      package: { type: 'string', description: 'Package name' },
      id: { type: 'string', description: 'Advisory ID' },
      severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Advisory severity' },
      title: { type: 'string', description: 'Advisory title' },
      description_text: { type: 'string', description: 'Advisory description' },
      url: { type: 'string', description: 'Advisory URL' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'check_package': {
          const pkg = String(params['package'] ?? '');
          if (!pkg) return { success: false, output: '', error: 'package required' };
          const advisories = await advisoryWatcher.checkPackage(pkg);
          const output = advisories.length > 0
            ? advisories.map((a) => `[${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')
            : `No advisories found for ${pkg}`;
          return { success: true, output, metadata: { count: advisories.length } };
        }
        case 'add': {
          const id = String(params['id'] ?? `adv-${Date.now()}`);
          const severity = String(params['severity'] ?? 'medium') as 'low' | 'medium' | 'high' | 'critical';
          const title = String(params['title'] ?? '');
          const description = String(params['description_text'] ?? '');
          const url = String(params['url'] ?? '');
          const pkg = String(params['package'] ?? '');
          advisoryWatcher.addAdvisory({ id, severity, title, description, affectedPackages: pkg ? [pkg] : [], url });
          return { success: true, output: `Added advisory: ${id}` };
        }
        case 'list': {
          const advisories = advisoryWatcher.getAdvisories();
          const output = advisories.map((a) => `[${a.severity.toUpperCase()}] ${a.id}: ${a.title}`).join('\n');
          return { success: true, output: output || 'No advisories', metadata: { count: advisories.length } };
        }
        case 'critical': {
          const critical = advisoryWatcher.getCriticalAdvisories();
          const output = critical.map((a) => `[${a.severity.toUpperCase()}] ${a.id}: ${a.title}`).join('\n');
          return { success: true, output: output || 'No critical advisories', metadata: { count: critical.length } };
        }
        case 'checked_packages': {
          const packages = advisoryWatcher.getCheckedPackages();
          return { success: true, output: packages.join('\n') || 'No packages checked', metadata: { count: packages.length } };
        }
        case 'clear': {
          advisoryWatcher.clear();
          return { success: true, output: 'Advisories cleared' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Advisories failed: ${e}` };
    }
  },
};
