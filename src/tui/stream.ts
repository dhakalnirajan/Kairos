import type { Pane } from './panes.ts';

export interface StreamRenderer {
  appendToken(token: string): void;
  appendText(text: string): void;
  appendToolCall(name: string, params: string): void;
  clear(): void;
  flush(): void;
  getBuffer(): string;
}

const ANSI_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]/g;

function stripUnauthorizedAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

const FLUSH_INTERVAL_MS = 40;

export function createStreamRenderer(pane: Pane): StreamRenderer {
  let buffer = '';
  let dirty = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  function scheduleFlush(): void {
    if (timer) return;
    dirty = true;
    timer = setInterval(() => {
      if (!dirty) {
        if (timer) { clearInterval(timer); timer = null; }
        return;
      }
      dirty = false;
      pane.setContent(buffer);
    }, FLUSH_INTERVAL_MS);
  }

  function immediateFlush(): void {
    if (timer) { clearInterval(timer); timer = null; }
    dirty = false;
    pane.setContent(buffer);
  }

  return {
    appendToken(token: string) {
      buffer += stripUnauthorizedAnsi(token);
      dirty = true;
      scheduleFlush();
    },

    appendText(text: string) {
      buffer += text;
      dirty = true;
      scheduleFlush();
    },

    appendToolCall(name: string, params: string) {
      buffer += `\n{#FFE66D-fg}[Tool: ${name}]{/} ${stripUnauthorizedAnsi(params)}\n`;
      dirty = true;
      scheduleFlush();
    },

    flush() {
      immediateFlush();
    },

    clear() {
      buffer = '';
      dirty = false;
      if (timer) { clearInterval(timer); timer = null; }
      pane.setContent('');
    },

    getBuffer() {
      return buffer;
    },
  };
}
