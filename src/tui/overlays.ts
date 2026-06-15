import blessed from 'neo-blessed';
import type { Theme } from './themes.ts';

export interface Overlay {
  widget: blessed.Widgets.BoxElement;
  show(): void;
  hide(): void;
  toggle(): void;
  isVisible(): boolean;
}

export function createCommandPalette(
  parent: blessed.Widgets.Node,
  theme: Theme,
): Overlay & { setQuery(q: string): void; onSelect(handler: (cmd: string) => void): void } {
  const commands = [
    "/help",
    "/clear",
    "/quit",
    "/exit",
    "/status",
    "/version",
    "/model",
    "/mode",
    "/theme",
    "/dream",
    "/compact",
    "/recall",
    "/forget",
    "/rules",
    "/alias",
    "/knowledge",
    "/persona",
    "/workflow",
    "/metrics",
    "/undo",
    "/sessions",
    "/export",
  ];
  let selectHandler: ((cmd: string) => void) | null = null;

  const list = blessed.list({
    parent,
    top: 'center',
    left: 'center',
    width: '50%',
    height: '60%',
    label: ' Command Palette ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.primary },
      label: { fg: theme.primary } as any,
      bold: false,
      selected: { bg: theme.primary, fg: '#fff' },
      item: { fg: theme.fg },
    },
    items: commands,
    keys: true,
    vi: true,
    mouse: true,
  });

  list.on('select', (item: { content?: string }) => {
    if (item.content) {
      selectHandler?.(item.content);
    }
  });

  list.on('cancel', () => {
    list.hide();
    parent.screen?.render();
  });

  list.hide();

  return {
    widget: list as unknown as blessed.Widgets.BoxElement,
    show() {
      list.setItems(commands);
      list.show();
      list.focus();
      parent.screen?.render();
    },
    hide() { list.hide(); parent.screen?.render(); },
    toggle() { list.hidden ? this.show() : this.hide(); },
    isVisible() { return !list.hidden; },
    setQuery(q: string) {
      const lower = q.toLowerCase();
      const filtered = commands.filter((c) => c.toLowerCase().includes(lower));
      list.setItems(filtered);
      parent.screen?.render();
    },
    onSelect(handler: (cmd: string) => void) { selectHandler = handler; },
  };
}

export function createFilePicker(
  parent: blessed.Widgets.Node,
  theme: Theme,
): Overlay & { setFiles(files: string[]): void; onSelect(handler: (file: string) => void): void } {
  let selectHandler: ((file: string) => void) | null = null;

  const list = blessed.list({
    parent,
    top: 'center',
    left: 'center',
    width: '60%',
    height: '70%',
    label: ' File Picker ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.primary },
      label: { fg: theme.primary } as any,
      bold: false,
      selected: { bg: theme.primary, fg: '#fff' },
      item: { fg: theme.fg },
    },
    keys: true,
    vi: true,
    mouse: true,
  });

  list.on('select', (item: { content?: string }) => {
    if (item.content) {
      selectHandler?.(item.content);
    }
  });

  list.on('cancel', () => {
    list.hide();
    parent.screen?.render();
  });

  list.hide();

  return {
    widget: list as unknown as blessed.Widgets.BoxElement,
    show() { list.show(); list.focus(); parent.screen?.render(); },
    hide() { list.hide(); parent.screen?.render(); },
    toggle() { list.hidden ? this.show() : this.hide(); },
    isVisible() { return !list.hidden; },
    setFiles(files: string[]) { list.setItems(files); parent.screen?.render(); },
    onSelect(handler: (file: string) => void) { selectHandler = handler; },
  };
}

export function createModalPrompt(
  parent: blessed.Widgets.Node,
  theme: Theme,
): Overlay & { setMessage(msg: string): void; getResponse(): Promise<boolean> } {
  let resolveResponse: ((val: boolean) => void) | null = null;

  const box = blessed.box({
    parent,
    top: 'center',
    left: 'center',
    width: '40%',
    height: 7,
    label: ' Confirm ',
    tags: true,
    border: { type: 'line' },
    style: {
      fg: theme.fg,
      bg: theme.bg,
      border: { fg: theme.warning },
      label: { fg: theme.warning },
      bold: false,
    },
    hidden: true,
  });

  const msgText = blessed.text({
    parent: box,
    top: 1,
    left: 1,
    width: '100%-2',
    height: 3,
    tags: true,
    content: '',
    style: { fg: theme.fg, bg: theme.bg, bold: false },
  });

  const btnYes = blessed.button({
    parent: box,
    bottom: 1,
    left: '30%',
    width: 10,
    height: 1,
    content: '[Y]es',
    tags: true,
    style: {
      fg: '#fff',
      bg: theme.success,
      bold: false,
      focus: { bg: theme.primary },
    },
  });

  const btnNo = blessed.button({
    parent: box,
    bottom: 1,
    left: '55%',
    width: 10,
    height: 1,
    content: '[N]o',
    tags: true,
    style: {
      fg: '#fff',
      bg: theme.error,
      bold: false,
      focus: { bg: theme.primary },
    },
  });

  btnYes.on('press', () => { box.hide(); parent.screen?.render(); resolveResponse?.(true); });
  btnNo.on('press', () => { box.hide(); parent.screen?.render(); resolveResponse?.(false); });

  box.key(['y', 'Y'], () => { box.hide(); parent.screen?.render(); resolveResponse?.(true); });
  box.key(['n', 'N'], () => { box.hide(); parent.screen?.render(); resolveResponse?.(false); });
  box.key(['escape'], () => { box.hide(); parent.screen?.render(); resolveResponse?.(false); });

  return {
    widget: box,
    show() { box.show(); box.focus(); parent.screen?.render(); },
    hide() { box.hide(); parent.screen?.render(); },
    toggle() { box.hidden ? this.show() : this.hide(); },
    isVisible() { return !box.hidden; },
    setMessage(msg: string) { msgText.setContent(msg); },
    getResponse(): Promise<boolean> {
      return new Promise((resolve) => {
        resolveResponse = resolve;
        this.show();
      });
    },
  };
}
