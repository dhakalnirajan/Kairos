import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const docsSyncTool: ToolInstance = {
  name: 'docs_sync',
  description: 'Living documentation sync: generate/update docs from code, detect doc drift, validate links',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['scan', 'generate_api_docs', 'check_drift', 'validate_links', 'generate_readme'], description: 'Docs action' },
      path: { type: 'string', description: 'File or directory to scan' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const targetPath = String(params['path'] ?? ctx.workspaceRoot);

    try {
      switch (action) {
        case 'scan': {
          const proc = Bun.spawn(['find', targetPath, '-name', '*.md', '-not', '-path', '*/node_modules/*'], { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
          const stdout = await new Response(proc.stdout).text();
          const files = stdout.trim().split('\n').filter((f) => f.trim());
          const summaries = files.map((f) => {
            try {
              const content = readFileSync(f, 'utf-8');
              const title = content.match(/^#\s+(.+)/m)?.[1] ?? '(no title)';
              const lines = content.split('\n').length;
              return `${f.replace(ctx.workspaceRoot + '/', '')}: "${title}" (${lines} lines)`;
            } catch {
              return `${f}: (unreadable)`;
            }
          });
          return { success: true, output: summaries.join('\n') || 'No markdown files found', metadata: { count: files.length } };
        }
        case 'generate_api_docs': {
          const proc = Bun.spawn(['find', targetPath, '-name', '*.ts', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/dist/*'], { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
          const stdout = await new Response(proc.stdout).text();
          const files = stdout.trim().split('\n').filter((f) => f.trim());
          const exports: string[] = [];
          for (const file of files.slice(0, 20)) {
            try {
              const content = readFileSync(file, 'utf-8');
              const exportMatches = content.matchAll(/export\s+(?:function|class|const|interface|type)\s+(\w+)/g);
              for (const m of exportMatches) {
                exports.push(`${file.replace(ctx.workspaceRoot + '/', '')} → ${m[1]}`);
              }
            } catch {}
          }
          return { success: true, output: exports.join('\n') || 'No exports found', metadata: { exports: exports.length } };
        }
        case 'check_drift': {
          const kairosMd = join(ctx.workspaceRoot, 'KAIROS.md');
          if (!existsSync(kairosMd)) return { success: true, output: 'No KAIROS.md found - no drift check needed' };
          const content = readFileSync(kairosMd, 'utf-8');
          const referencedFiles = content.matchAll(/`([^`]+\.(?:ts|js|json))`/g);
          const issues: string[] = [];
          for (const m of referencedFiles) {
            const filePath = m[1];
            if (filePath && !existsSync(join(ctx.workspaceRoot, filePath))) {
              issues.push(`Referenced file not found: ${filePath}`);
            }
          }
          return {
            success: issues.length === 0,
            output: issues.length > 0 ? `Drift detected:\n${issues.join('\n')}` : 'No documentation drift detected',
            metadata: { issues: issues.length },
          };
        }
        case 'validate_links': {
          const proc = Bun.spawn(['find', targetPath, '-name', '*.md', '-not', '-path', '*/node_modules/*'], { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
          const stdout = await new Response(proc.stdout).text();
          const files = stdout.trim().split('\n').filter((f) => f.trim());
          const brokenLinks: string[] = [];
          for (const file of files) {
            try {
              const content = readFileSync(file, 'utf-8');
              const links = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
              for (const m of links) {
                const target = m[2];
                if (target && !target.startsWith('http') && !existsSync(join(ctx.workspaceRoot, target))) {
                  brokenLinks.push(`${file}: [${m[1]}](${target})`);
                }
              }
            } catch {}
          }
          return {
            success: brokenLinks.length === 0,
            output: brokenLinks.length > 0 ? `Broken links:\n${brokenLinks.join('\n')}` : 'All links valid',
            metadata: { broken: brokenLinks.length },
          };
        }
        case 'generate_readme': {
          const proc = Bun.spawn(['find', targetPath, '-name', '*.ts', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/dist/*'], { cwd: ctx.workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
          const stdout = await new Response(proc.stdout).text();
          const files = stdout.trim().split('\n').filter((f) => f.trim());
          const modules = files.map((f) => f.replace(ctx.workspaceRoot + '/', '').replace(/\.ts$/, ''));
          const readme = `# Kairos Code\n\n## Modules\n${modules.map((m) => `- \`${m}\``).join('\n')}\n`;
          return { success: true, output: readme };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Docs sync failed: ${e}` };
    }
  },
};
