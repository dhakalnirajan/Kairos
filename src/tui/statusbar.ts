import blessed from 'neo-blessed';
import type { Theme } from './themes.ts';

export interface StatusInfo {
  mode: string;
  model: string;
  tokens: number;
  cost: number;
}

export function createStatusBar(
  screen: blessed.Widgets.Screen,
  theme: Theme,
): { widget: blessed.Widgets.BoxElement; update(info: StatusInfo): void } {
  let lastInfo: StatusInfo = { mode: 'NORMAL', model: '', tokens: 0, cost: 0 };

  function formatBar(info: StatusInfo): string {
    const mode = ` ${info.mode} `;
    const model = info.model || 'no model';
    const tokens = info.tokens > 0 ? ` ${info.tokens} tokens` : '';
    const cost = info.cost > 0 ? ` $${info.cost.toFixed(4)}` : '';
    return `{${theme.primary}-fg}{bold}${mode}{/bold}{/} {${theme.muted}-fg}│{/} ${model} {${theme.muted}-fg}│{/}${tokens} {${theme.muted}-fg}│{/}${cost}`;
  }

  const widget = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    content: formatBar(lastInfo),
    style: {
      fg: theme.fg,
      bg: theme.surface,
      bold: false,
    },
  });

  return {
    widget,
    update(info: StatusInfo) {
      lastInfo = info;
      widget.setContent(formatBar(info));
      screen.render();
    },
  };
}
