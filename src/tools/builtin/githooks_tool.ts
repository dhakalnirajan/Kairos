import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { gitHookManager } from '../devops/githooks.ts';

export const githooksTool: ToolInstance = {
  name: 'git_hooks',
  description: 'Git hook management: install, remove, list, enable/disable git hooks',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['install', 'remove', 'list', 'content', 'enable', 'disable'], description: 'Hook action' },
      name: { type: 'string', description: 'Hook name (pre-commit, post-commit, etc.)' },
      script: { type: 'string', description: 'Hook script content' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const name = String(params['name'] ?? '');

    try {
      switch (action) {
        case 'install': {
          if (!name) return { success: false, output: '', error: 'name required' };
          const script = String(params['script'] ?? '#!/bin/sh\n');
          const ok = await gitHookManager.installHook(name, script);
          return { success: ok, output: ok ? `Installed hook: ${name}` : 'Failed to install hook' };
        }
        case 'remove': {
          if (!name) return { success: false, output: '', error: 'name required' };
          const ok = await gitHookManager.removeHook(name);
          return { success: ok, output: ok ? `Removed hook: ${name}` : 'Failed to remove hook' };
        }
        case 'list': {
          const hooks = await gitHookManager.listHooks();
          const output = hooks.map((h: string) => h).join('\n');
          return { success: true, output: output || 'No hooks installed', metadata: { count: hooks.length } };
        }
        case 'content': {
          if (!name) return { success: false, output: '', error: 'name required' };
          const content = await gitHookManager.getHookContent(name);
          return content !== null
            ? { success: true, output: content }
            : { success: false, output: '', error: `Hook not found: ${name}` };
        }
        case 'enable': {
          if (!name) return { success: false, output: '', error: 'name required' };
          await gitHookManager.enableHook(name);
          return { success: true, output: `Enabled hook: ${name}` };
        }
        case 'disable': {
          if (!name) return { success: false, output: '', error: 'name required' };
          await gitHookManager.disableHook(name);
          return { success: true, output: `Disabled hook: ${name}` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Git hooks failed: ${e}` };
    }
  },
};
