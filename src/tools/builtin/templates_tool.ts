import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { templateEngine } from '../templates.ts';

export const templatesTool: ToolInstance = {
  name: 'templates',
  description: 'File template engine: register, list, and apply file templates with variable interpolation',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['register', 'apply', 'list', 'get'], description: 'Template action' },
      name: { type: 'string', description: 'Template name' },
      description_text: { type: 'string', description: 'Template description' },
      files_json: { type: 'string', description: 'JSON array of {path, content} files' },
      variables_json: { type: 'string', description: 'JSON object of variable values' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'register': {
          const name = String(params['name'] ?? '');
          if (!name) return { success: false, output: '', error: 'name required' };
          const description = String(params['description_text'] ?? '');
          const filesJson = String(params['files_json'] ?? '[]');
          const files = JSON.parse(filesJson) as Array<{ path: string; content: string }>;
          const allVars = new Set<string>();
          for (const f of files) {
            const matches = f.content.match(/\{\{(\w+)\}\}/g);
            if (matches) matches.forEach((m) => allVars.add(m.replace(/\{\{|\}\}/g, '')));
          }
          templateEngine.registerTemplate({ name, description, files, variables: Array.from(allVars) });
          return { success: true, output: `Registered template: ${name} with ${files.length} files and ${allVars.size} variables` };
        }
        case 'apply': {
          const name = String(params['name'] ?? '');
          if (!name) return { success: false, output: '', error: 'name required' };
          const varsJson = String(params['variables_json'] ?? '{}');
          const variables = JSON.parse(varsJson) as Record<string, string>;
          const result = await templateEngine.applyTemplate(name, variables);
          const output = result.map((f) => `--- ${f.path} ---\n${f.content}`).join('\n\n');
          return { success: true, output, metadata: { files: result.length } };
        }
        case 'list': {
          const templates = templateEngine.listTemplates();
          const output = templates.join('\n') || 'No templates registered';
          return { success: true, output, metadata: { count: templates.length } };
        }
        case 'get': {
          const name = String(params['name'] ?? '');
          if (!name) return { success: false, output: '', error: 'name required' };
          const template = templateEngine.getTemplate(name);
          return template
            ? { success: true, output: `Template: ${template.name}\nDescription: ${template.description}\nFiles: ${template.files.length}\nVariables: ${template.variables.join(', ')}` }
            : { success: false, output: '', error: `Template not found: ${name}` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Templates failed: ${e}` };
    }
  },
};
