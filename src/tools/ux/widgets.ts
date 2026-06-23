export interface WidgetConfig {
  id: string;
  type: 'text' | 'progress' | 'status' | 'list';
  title: string;
  content: string | string[];
  position: 'left' | 'center' | 'right';
}

export class WidgetManager {
  private widgets: Map<string, WidgetConfig> = new Map();

  addWidget(config: WidgetConfig): void {
    this.widgets.set(config.id, config);
  }

  removeWidget(id: string): boolean {
    return this.widgets.delete(id);
  }

  updateWidget(id: string, updates: Partial<WidgetConfig>): boolean {
    const widget = this.widgets.get(id);
    if (!widget) return false;
    Object.assign(widget, updates);
    return true;
  }

  getWidget(id: string): WidgetConfig | undefined {
    return this.widgets.get(id);
  }

  getAllWidgets(): WidgetConfig[] {
    return Array.from(this.widgets.values());
  }

  renderWidget(widget: WidgetConfig): string {
    const lines: string[] = [`[${widget.title}]`];

    if (typeof widget.content === 'string') {
      lines.push(widget.content);
    } else {
      for (const item of widget.content) {
        lines.push(`  • ${item}`);
      }
    }

    return lines.join('\n');
  }

  renderStatusBar(): string {
    const widgets = this.getAllWidgets();
    return widgets.map((w) => this.renderWidget(w)).join(' | ');
  }
}

export const widgetManager = new WidgetManager();
