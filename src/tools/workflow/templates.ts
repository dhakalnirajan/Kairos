export interface Template {
  name: string;
  description: string;
  files: Array<{ path: string; content: string }>;
  variables: string[];
}

export class TemplateEngine {
  private templates: Map<string, Template> = new Map();

  registerTemplate(template: Template): void {
    this.templates.set(template.name, template);
  }

  async applyTemplate(name: string, variables: Record<string, string>): Promise<Array<{ path: string; content: string }>> {
    const template = this.templates.get(name);
    if (!template) throw new Error(`Template not found: ${name}`);

    return template.files.map((file) => ({
      path: this.interpolate(file.path, variables),
      content: this.interpolate(file.content, variables),
    }));
  }

  private interpolate(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  getTemplate(name: string): Template | undefined {
    return this.templates.get(name);
  }
}

export const templateEngine = new TemplateEngine();
