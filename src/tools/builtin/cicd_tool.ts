import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const cicdTool: ToolInstance = {
  name: 'cicd_optimiser',
  description: 'CI/CD optimiser: analyse pipeline configs, detect slow steps, suggest caching, validate workflow files',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['analyse', 'suggest_cache', 'validate', 'compare_steps'], description: 'CI/CD action' },
      path: { type: 'string', description: 'CI config directory' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      const cicdPaths = [
        '.github/workflows',
        '.gitlab-ci.yml',
        'Jenkinsfile',
        '.circleci/config.yml',
        'azure-pipelines.yml',
        '.travis.yml',
      ];

      const foundConfigs: Array<{ path: string; type: string; content: string }> = [];
      for (const p of cicdPaths) {
        const fullPath = join(ctx.workspaceRoot, p);
        if (existsSync(fullPath)) {
          try {
            const stat = require('fs').statSync(fullPath);
            if (stat.isFile()) {
              foundConfigs.push({ path: p, type: p.split('.').pop() ?? 'unknown', content: readFileSync(fullPath, 'utf-8') });
            } else if (stat.isDirectory()) {
              const { readdirSync } = require('fs');
              for (const f of readdirSync(fullPath)) {
                if (f.endsWith('.yml') || f.endsWith('.yaml')) {
                  foundConfigs.push({ path: `${p}/${f}`, type: 'yaml', content: readFileSync(join(fullPath, f), 'utf-8') });
                }
              }
            }
          } catch {}
        }
      }

      switch (action) {
        case 'analyse': {
          if (foundConfigs.length === 0) return { success: true, output: 'No CI/CD configuration files found' };
          const output = foundConfigs.map((c) => {
            const lines = c.content.split('\n');
            const jobs = (c.content.match(/jobs:|steps:/g) || []).length;
            const hasCache = /cache:|uses: actions\/cache/g.test(c.content);
            const hasMatrix = /matrix:/g.test(c.content);
            return `📄 ${c.path}\n   Steps/Jobs: ${jobs} | Cache: ${hasCache ? '✓' : '✗'} | Matrix: ${hasMatrix ? '✓' : '✗'} | Lines: ${lines.length}`;
          }).join('\n\n');
          return { success: true, output, metadata: { configs: foundConfigs.length } };
        }
        case 'suggest_cache': {
          if (foundConfigs.length === 0) return { success: true, output: 'No CI/CD configs to analyse' };
          const suggestions: string[] = [];
          for (const c of foundConfigs) {
            if (!/cache:|uses: actions\/cache/g.test(c.content)) {
              suggestions.push(`${c.path}: Add caching for dependencies (actions/cache or setup-node cache)`);
            }
            if (/npm install|yarn install|bun install/g.test(c.content) && !/cache/g.test(c.content)) {
              suggestions.push(`${c.path}: Package install without caching is slow`);
            }
            if (/docker build/g.test(c.content) && !/layers|cache-from/g.test(c.content)) {
              suggestions.push(`${c.path}: Docker build without layer caching`);
            }
            if (/test|lint|typecheck/g.test(c.content) && /runs-on:.*windows/gi.test(c.content)) {
              suggestions.push(`${c.path}: Consider Linux runners for faster CI (cheaper, faster)`);
            }
          }
          return { success: true, output: suggestions.length > 0 ? suggestions.map((s) => `💡 ${s}`).join('\n') : 'CI/CD already well-optimised' };
        }
        case 'validate': {
          const issues: string[] = [];
          for (const c of foundConfigs) {
            if (c.type === 'yaml') {
              if (!/^name:/m.test(c.content)) issues.push(`${c.path}: Missing 'name' field`);
              if (!/on:/m.test(c.content)) issues.push(`${c.path}: Missing 'on' trigger`);
              if (/secrets\.\w+/g.test(c.content) && !/env:/g.test(c.content)) issues.push(`${c.path}: Uses secrets but may need env mapping`);
            }
          }
          return { success: issues.length === 0, output: issues.length > 0 ? issues.map((i) => `⚠ ${i}`).join('\n') : 'All CI/CD configs look valid' };
        }
        case 'compare_steps': {
          if (foundConfigs.length < 2) return { success: true, output: 'Need at least 2 configs to compare' };
          const extractSteps = (content: string) => {
            const steps = content.match(/- name:\s*(.+)/g) || [];
            return steps.map((s) => s.replace(/- name:\s*/, '').trim());
          };
          const allSteps = foundConfigs.map((c) => ({ path: c.path, steps: extractSteps(c.content) }));
          const output = allSteps.map((a) => `${a.path}: ${a.steps.length} steps\n  ${a.steps.join(', ')}`).join('\n\n');
          return { success: true, output };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `CI/CD analysis failed: ${e}` };
    }
  },
};
