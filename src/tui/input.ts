import blessed from 'neo-blessed';
import type { Theme } from './themes.ts';

const SLASH_COMMANDS = [
  '/compact', '/dream', '/init', '/undo', '/redo', '/new',
  '/sessions', '/editor', '/details', '/thinking', '/export',
  '/models', '/themes', '/help', '/quit',
];

function fuzzyMatch(query: string, candidates: string[]): string[] {
  const lower = query.toLowerCase();
  return candidates.filter((c) => c.toLowerCase().includes(lower));
}

export interface InputBox {
  widget: blessed.Widgets.TextareaElement;
  onSubmit(handler: (text: string) => void): void;
  getValue(): string;
  setValue(v: string): void;
  focus(): void;
}

export function createInputBox(
  screen: blessed.Widgets.Screen,
  theme: Theme,
): InputBox {
  const history: string[] = [];
  let historyIndex = -1;
  let submitHandler: ((text: string) => void) | null = null;

  const widget = blessed.textarea({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    label: ' Input ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.border },
      label: { fg: theme.primary },
      focus: { border: { fg: theme.primary } },
    },
    inputOnFocus: true,
    wrap: true,
    keys: true,
    vi: false,
  });

  widget.on('submit', (value: string) => {
    const text = value.trim();
    if (text) {
      history.push(text);
      historyIndex = history.length;
      submitHandler?.(text);
      widget.setValue('');
    }
  });

  widget.key(['up'], () => {
    if (historyIndex > 0) {
      historyIndex--;
      widget.setValue(history[historyIndex] ?? '');
    }
  });

  widget.key(['down'], () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      widget.setValue(history[historyIndex] ?? '');
    } else {
      historyIndex = history.length;
      widget.setValue('');
    }
  });

  widget.key(['tab'], () => {
    const current = widget.getValue();
    const matches = fuzzyMatch(current, SLASH_COMMANDS);
    if (matches.length === 1) {
      widget.setValue(matches[0] ?? '');
    }
  });

  return {
    widget,
    onSubmit(handler: (text: string) => void) {
      submitHandler = handler;
    },
    getValue() { return widget.getValue(); },
    setValue(v: string) { widget.setValue(v); },
    focus() { widget.focus(); },
  };
}
