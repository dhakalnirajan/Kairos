import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const onboardingTool: ToolInstance = {
  name: 'onboarding_path',
  description: 'Onboarding path generator: analyse codebase complexity, generate learning paths, identify key files for new contributors',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['generate_path', 'key_files', 'complexity_map', 'entry_points'], description: 'Onboarding action' },
      role: { type: 'string', enum: ['frontend', 'backend', 'fullstack', 'devops', 'data'], description: 'Contributor role' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const role = String(params['role'] ?? 'fullstack');

    try {
      const { readdirSync, statSync } = require('fs');
      const allFiles: string[] = [];

      const walk = (dir: string, depth = 0) => {
        if (depth > 4) return;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist', '.kairos'].includes(entry.name)) {
              walk(full, depth + 1);
            } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md)$/.test(entry.name)) {
              allFiles.push(full);
            }
          }
        } catch {}
      };
      walk(ctx.workspaceRoot);

      switch (action) {
        case 'generate_path': {
          const steps: string[] = [];
          const readme = join(ctx.workspaceRoot, 'README.md');
          if (existsSync(readme)) steps.push('1. Read README.md for project overview');

          const kairosMd = join(ctx.workspaceRoot, 'KAIROS.md');
          if (existsSync(kairosMd)) steps.push('2. Read KAIROS.md for architecture decisions');

          const pkgJson = join(ctx.workspaceRoot, 'package.json');
          if (existsSync(pkgJson)) steps.push('3. Review package.json for dependencies and scripts');

          const srcDir = join(ctx.workspaceRoot, 'src');
          if (existsSync(srcDir)) steps.push('4. Explore src/ directory structure');

          const entryPoints = allFiles.filter((f) => /cli\.ts|main\.ts|index\.ts$/i.test(f.replace(ctx.workspaceRoot + '/', '')));
          if (entryPoints.length > 0) {
            steps.push(`5. Start at entry point(s): ${entryPoints.map((f) => f.replace(ctx.workspaceRoot + '/', '')).join(', ')}`);
          }

          if (role === 'frontend') {
            steps.push('6. Focus on TUI components in src/tui/');
          } else if (role === 'backend') {
            steps.push('6. Focus on agent/LLM/tool systems in src/agent/, src/llm/, src/tools/');
          } else if (role === 'devops') {
            steps.push('6. Focus on daemon, CLI, and deployment in src/daemon/, src/cli/');
          }

          steps.push(`${steps.length + 1}. Run \`bun run typecheck\` to verify setup`);
          steps.push(`${steps.length + 2}. Run \`bun test\` to see test patterns`);

          return { success: true, output: `Onboarding path for ${role}:\n\n${steps.join('\n')}` };
        }
        case 'key_files': {
          const important: Array<{ file: string; reason: string }> = [];
          for (const f of allFiles) {
            const rel = f.replace(ctx.workspaceRoot + '/', '');
            if (/config\.ts|schema\.ts$/i.test(rel)) important.push({ file: rel, reason: 'Configuration/schema' });
            else if (/types\.ts$/i.test(rel)) important.push({ file: rel, reason: 'Type definitions' });
            else if (/index\.ts$/i.test(rel) && rel.split('/').length <= 3) important.push({ file: rel, reason: 'Module entry point' });
            else if (/main\.ts|cli\.ts$/i.test(rel)) important.push({ file: rel, reason: 'Application entry' });
            else if (/agent\.ts|loop\.ts$/i.test(rel)) important.push({ file: rel, reason: 'Core agent logic' });
          }
          const output = important.map((f) => `${f.file} — ${f.reason}`).join('\n');
          return { success: true, output: output || 'No key files identified', metadata: { count: important.length } };
        }
        case 'complexity_map': {
          const dirs = new Map<string, number>();
          for (const f of allFiles) {
            const rel = f.replace(ctx.workspaceRoot + '/', '');
            const dir = rel.split('/').slice(0, 2).join('/');
            dirs.set(dir, (dirs.get(dir) ?? 0) + 1);
          }
          const sorted = Array.from(dirs.entries()).sort((a, b) => b[1] - a[1]);
          const output = sorted.map(([dir, count]) => `${dir.padEnd(30)} ${count} files`).join('\n');
          return { success: true, output, metadata: { directories: sorted.length } };
        }
        case 'entry_points': {
          const entryPatterns = [/cli\.ts$/i, /main\.ts$/i, /index\.ts$/i, /server\.ts$/i, /daemon.*\.ts$/i];
          const entries = allFiles.filter((f) => entryPatterns.some((p) => p.test(f.replace(ctx.workspaceRoot + '/', ''))));
          const output = entries.map((f) => f.replace(ctx.workspaceRoot + '/', '')).join('\n');
          return { success: true, output: output || 'No entry points found', metadata: { count: entries.length } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Onboarding path failed: ${e}` };
    }
  },
};
