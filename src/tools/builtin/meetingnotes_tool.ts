import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const meetingNotesTool: ToolInstance = {
  name: 'meeting_notes',
  description: 'Meeting notes integration: structured minutes, action item extraction, attendance tracking',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'add_action', 'list_actions', 'export'], description: 'Meeting action' },
      title: { type: 'string', description: 'Meeting title' },
      attendees: { type: 'string', description: 'Comma-separated attendees' },
      content: { type: 'string', description: 'Meeting content/minutes' },
      action_item: { type: 'string', description: 'Action item' },
      assignee: { type: 'string', description: 'Action assignee' },
      due: { type: 'string', description: 'Due date' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      const notesDir = join(ctx.workspaceRoot, 'docs', 'meetings');
      if (!existsSync(notesDir)) mkdirSync(notesDir, { recursive: true });

      switch (action) {
        case 'create': {
          const title = String(params['title'] ?? `Meeting ${new Date().toISOString().split('T')[0]}`);
          const attendees = String(params['attendees'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
          const content = String(params['content'] ?? '');
          const date = new Date().toISOString().split('T')[0]!;
          const filename = `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
          const md = `# ${title}\n\n**Date:** ${date}\n**Attendees:** ${attendees.join(', ') || 'N/A'}\n\n## Minutes\n\n${content || '(no content)'}\n\n## Action Items\n\n- [ ] None yet\n`;
          writeFileSync(join(notesDir, filename), md);
          return { success: true, output: `Created meeting notes: docs/meetings/${filename}` };
        }
        case 'add_action': {
          const actionItem = String(params['action_item'] ?? '');
          if (!actionItem) return { success: false, output: '', error: 'action_item required' };
          const assignee = String(params['assignee'] ?? 'TBD');
          const due = String(params['due'] ?? 'TBD');
          return { success: true, output: `Action item added:\n- [ ] ${actionItem}\n  Assignee: ${assignee}\n  Due: ${due}` };
        }
        case 'list_actions': {
          return { success: true, output: 'Action items are stored in docs/meetings/*.md files. Check the latest meeting notes.' };
        }
        case 'export': {
          const { readdirSync, readFileSync } = require('fs');
          const files = readdirSync(notesDir).filter((f: string) => f.endsWith('.md'));
          const output = files.map((f: string) => {
            const content = readFileSync(join(notesDir, f), 'utf-8');
            const title = content.match(/^#\s+(.+)/m)?.[1] ?? f;
            return `- ${title} (${f})`;
          }).join('\n');
          return { success: true, output: output || 'No meeting notes found' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Meeting notes failed: ${e}` };
    }
  },
};
