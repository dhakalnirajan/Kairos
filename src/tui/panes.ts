import blessed from 'neo-blessed';
import type { Theme } from './themes.ts';

export interface Pane {
  widget: blessed.Widgets.BoxElement;
  append(text: string): void;
  setContent(text: string): void;
  getContent(): string;
  scroll(pos: number): void;
  getScrollHeight(): number;
}

const RENDER_INTERVAL_MS = 33;

export function createLayout(
  screen: blessed.Widgets.Screen,
  theme: Theme,
): { chatPane: Pane; contextPane: Pane } {
  const chatWidget = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '70%',
    height: '100%-1',
    label: ' Chat ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.border },
      label: { fg: theme.primary },
      bold: false,
    },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { style: { bg: theme.muted } },
  });

  const contextWidget = blessed.box({
    parent: screen,
    top: 0,
    left: '70%',
    width: '30%',
    height: '100%-1',
    label: ' Context ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.secondary,
      bg: theme.bg,
      border: { fg: theme.border },
      label: { fg: theme.primary },
      bold: false,
    },
    scrollable: true,
    alwaysScroll: true,
  });

  function createPane(widget: blessed.Widgets.BoxElement): Pane {
    let content = '';
    let dirty = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    function scheduleRender(): void {
      if (timer) return;
      dirty = true;
      timer = setInterval(() => {
        if (!dirty) {
          if (timer) { clearInterval(timer); timer = null; }
          return;
        }
        dirty = false;
        widget.setContent(content);
        widget.scroll(widget.getScrollHeight());
      }, RENDER_INTERVAL_MS);
    }

    function immediateRender(): void {
      if (timer) { clearInterval(timer); timer = null; }
      dirty = false;
      widget.setContent(content);
      widget.scroll(widget.getScrollHeight());
    }

    return {
      widget,
      append(text: string) {
        content += text;
        dirty = true;
        scheduleRender();
      },
      setContent(text: string) {
        content = text;
        dirty = true;
        scheduleRender();
      },
      getContent() { return widget.getContent(); },
      scroll(pos: number) { widget.scroll(pos); },
      getScrollHeight() { return widget.getScrollHeight(); },
    };
  }

  return { chatPane: createPane(chatWidget), contextPane: createPane(contextWidget) };
}
