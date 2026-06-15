import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export const archSketchTool: ToolInstance = {
  name: 'architecture_sketch',
  description: 'Architecture sketching: ASCII whiteboard diagrams, box-drawing characters, component diagrams',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['box_diagram', 'layered_arch', 'sequence', 'save'], description: 'Diagram action' },
      components: { type: 'string', description: 'Comma-separated component names' },
      layers: { type: 'string', description: 'Comma-separated layer names' },
      title: { type: 'string', description: 'Diagram title' },
      content: { type: 'string', description: 'Diagram content to save' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'box_diagram': {
          const components = String(params['components'] ?? 'Component A, Component B, Component C').split(',').map((s) => s.trim());
          const title = String(params['title'] ?? 'Architecture');
          const maxLen = Math.max(...components.map((c) => c.length));
          const w = maxLen + 4;
          const border = '─'.repeat(w);
          const boxes = components.map((c) => `│ ${c.padEnd(maxLen)} │`);
          const diagram = [
            `┌${border}┐`,
            `│${title.padEnd(w)}│`,
            `├${border}┤`,
            ...boxes,
            `└${border}┘`,
          ].join('\n');
          return { success: true, output: diagram };
        }
        case 'layered_arch': {
          const layers = String(params['layers'] ?? 'Presentation, Business Logic, Data Access, Database').split(',').map((s) => s.trim());
          const title = String(params['title'] ?? 'Layered Architecture');
          const maxLen = Math.max(...layers.map((l) => l.length));
          const w = maxLen + 6;
          const diagram = [
            `═══ ${title} ═══`,
            '',
            ...layers.map((l, i) => `${'  '.repeat(i)}┌${'─'.repeat(w)}┐\n${'  '.repeat(i)}│ ${l.padEnd(maxLen)} │\n${'  '.repeat(i)}└${'─'.repeat(w)}┘${i < layers.length - 1 ? `\n${'  '.repeat(i + 1)}│` : ''}`),
          ].join('\n');
          return { success: true, output: diagram };
        }
        case 'sequence': {
          const components = String(params['components'] ?? 'Client, Server, Database').split(',').map((s) => s.trim());
          const maxLen = Math.max(...components.map((c) => c.length));
          const w = maxLen + 4;
          const diagram = [
            'Sequence Diagram',
            '',
            ...components.map((c) => `┌${'─'.repeat(w)}┐\n│ ${c.padEnd(maxLen)} │\n└${'─'.repeat(w)}┘`),
            '',
            'Interaction flow:',
            ...components.slice(0, -1).map((c, i) => `  ${c} --> ${components[i + 1]}: request`),
            ...components.slice(1).reverse().map((c, i) => `  ${c} --> ${components[components.length - 2 - i]}: response`),
          ].join('\n');
          return { success: true, output: diagram };
        }
        case 'save': {
          const content = String(params['content'] ?? '');
          const title = String(params['title'] ?? 'diagram');
          if (!content) return { success: false, output: '', error: 'content required' };
          const dir = join(ctx.workspaceRoot, 'docs', 'diagrams');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          const file = join(dir, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`);
          writeFileSync(file, `# ${title}\n\n\`\`\`\n${content}\n\`\`\`\n`);
          return { success: true, output: `Saved diagram to docs/diagrams/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Architecture sketch failed: ${e}` };
    }
  },
};
