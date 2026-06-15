import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';

interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  date: string;
  context: string;
  decision: string;
  consequences: string;
  supersededBy?: string;
}

export const adrTool: ToolInstance = {
  name: 'adr_keeper',
  description: 'Architecture Decision Records: create, list, update, and query ADRs',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'list', 'get', 'update_status', 'supersede', 'search'], description: 'ADR action' },
      id: { type: 'string', description: 'ADR ID (e.g. 001)' },
      title: { type: 'string', description: 'ADR title' },
      status: { type: 'string', enum: ['proposed', 'accepted', 'deprecated', 'superseded'], description: 'ADR status' },
      context: { type: 'string', description: 'Context section' },
      decision: { type: 'string', description: 'Decision section' },
      consequences: { type: 'string', description: 'Consequences section' },
      superseded_by: { type: 'string', description: 'ID of superseding ADR' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const adrDir = join(ctx.workspaceRoot, 'docs', 'adrs');

    try {
      if (!existsSync(adrDir)) {
        mkdirSync(adrDir, { recursive: true });
      }

      function listADRFiles(): string[] {
        const { readdirSync } = require('fs') as typeof import('fs');
        try {
          return readdirSync(adrDir).filter((f: string) => f.endsWith('.md')).sort();
        } catch {
          return [];
        }
      }

      function parseADR(content: string, filename: string): ADR {
        const id = filename.replace(/\.md$/, '').split('-')[0] ?? filename.replace(/\.md$/, '');
        const title = content.match(/^#\s+(.+)/m)?.[1] ?? filename;
        const status = (content.match(/##\s+Status\s*\n\s*(\w+)/i)?.[1] ?? 'proposed') as ADR['status'];
        const date = content.match(/##\s+Date\s*\n\s*(.+)/i)?.[1] ?? '';
        const context = content.match(/##\s+Context\s*\n([\s\S]*?)(?=##|$)/i)?.[1]?.trim() ?? '';
        const decision = content.match(/##\s+Decision\s*\n([\s\S]*?)(?=##|$)/i)?.[1]?.trim() ?? '';
        const consequences = content.match(/##\s+Consequences\s*\n([\s\S]*?)(?=##|$)/i)?.[1]?.trim() ?? '';
        return { id, title, status, date, context, decision, consequences };
      }

      switch (action) {
        case 'create': {
          const id = String(params['id'] ?? String(listADRFiles().length + 1).padStart(3, '0'));
          const title = String(params['title'] ?? 'Untitled Decision');
          const context = String(params['context'] ?? '');
          const decision = String(params['decision'] ?? '');
          const consequences = String(params['consequences'] ?? '');
          const date = new Date().toISOString().split('T')[0]!;
          const adrContent = `# ${title}\n\n## Status\n\nProposed\n\n## Date\n\n${date}\n\n## Context\n\n${context}\n\n## Decision\n\n${decision}\n\n## Consequences\n\n${consequences}\n`;
          const filename = `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.md`;
          writeFileSync(join(adrDir, filename), adrContent);
          return { success: true, output: `Created ADR-${id}: ${title}\nFile: docs/adrs/${filename}` };
        }
        case 'list': {
          const files = listADRFiles();
          if (files.length === 0) return { success: true, output: 'No ADRs found' };
          const adrs = files.map((f) => {
            const content = readFileSync(join(adrDir, f), 'utf-8');
            const parsed = parseADR(content, f);
            return `[${parsed.status.toUpperCase()}] ADR-${parsed.id}: ${parsed.title}`;
          });
          return { success: true, output: adrs.join('\n'), metadata: { count: files.length } };
        }
        case 'get': {
          const id = String(params['id'] ?? '');
          if (!id) return { success: false, output: '', error: 'id required' };
          const files = listADRFiles();
          const file = files.find((f) => f.startsWith(id));
          if (!file) return { success: false, output: '', error: `ADR not found: ${id}` };
          const content = readFileSync(join(adrDir, file), 'utf-8');
          return { success: true, output: content };
        }
        case 'update_status': {
          const id = String(params['id'] ?? '');
          const status = String(params['status'] ?? 'accepted') as ADR['status'];
          if (!id) return { success: false, output: '', error: 'id required' };
          const files = listADRFiles();
          const file = files.find((f) => f.startsWith(id));
          if (!file) return { success: false, output: '', error: `ADR not found: ${id}` };
          let content = readFileSync(join(adrDir, file), 'utf-8');
          content = content.replace(/##\s+Status\s*\n\s*\w+/i, `## Status\n\n${status}`);
          writeFileSync(join(adrDir, file), content);
          return { success: true, output: `Updated ADR-${id} status to ${status}` };
        }
        case 'supersede': {
          const id = String(params['id'] ?? '');
          const supersededBy = String(params['superseded_by'] ?? '');
          if (!id || !supersededBy) return { success: false, output: '', error: 'id and superseded_by required' };
          const files = listADRFiles();
          const file = files.find((f) => f.startsWith(id));
          if (!file) return { success: false, output: '', error: `ADR not found: ${id}` };
          let content = readFileSync(join(adrDir, file), 'utf-8');
          content = content.replace(/##\s+Status\s*\n\s*\w+/i, `## Status\n\nSuperseded by ADR-${supersededBy}`);
          writeFileSync(join(adrDir, file), content);
          return { success: true, output: `ADR-${id} superseded by ADR-${supersededBy}` };
        }
        case 'search': {
          const query = String(params['title'] ?? '').toLowerCase();
          if (!query) return { success: false, output: '', error: 'title (search query) required' };
          const files = listADRFiles();
          const matches = files.filter((f) => {
            const content = readFileSync(join(adrDir, f), 'utf-8').toLowerCase();
            return content.includes(query);
          });
          const output = matches.map((f) => `- ${f}`).join('\n');
          return { success: true, output: output || 'No matches found', metadata: { count: matches.length } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `ADR keeper failed: ${e}` };
    }
  },
};
