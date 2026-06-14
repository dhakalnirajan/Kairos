import { describe, test, expect } from 'bun:test';
import { THEMES, getTheme } from '../src/tui/themes.ts';
import { MASCOT_BLOCK, MASCOT_DRAWING } from '../src/tui/mascot.ts';
import { createStreamRenderer } from '../src/tui/stream.ts';
import { createCommandPalette, createFilePicker } from '../src/tui/overlays.ts';
import blessed from 'neo-blessed';

const fullTheme = {
  name: 'test', primary: '#208AAE', secondary: '#A0A0A0', accent: '#FF6B6B',
  bg: '#1A1A2E', fg: '#E0E0E0', surface: '#16213E', muted: '#666',
  success: '#4ECDC4', error: '#FF6B6B', warning: '#FFE66D',
  border: '#3A3A5C', highlight: '#208AAE',
};

function createTestScreen() {
  return blessed.screen({ smartCSR: true, input: process.stdin, output: process.stdout });
}

describe('Themes', () => {
  test('has all themes', () => {
    expect(Object.keys(THEMES)).toContain('default');
    expect(Object.keys(THEMES)).toContain('dracula');
    expect(Object.keys(THEMES)).toContain('monokai');
  });

  test('getTheme returns default for unknown', () => {
    expect(getTheme('nonexistent').name).toBe('default');
  });

  test('each theme has required properties', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.primary).toBeDefined();
      expect(theme.bg).toBeDefined();
      expect(theme.fg).toBeDefined();
    }
  });
});

describe('Mascot', () => {
  test('MASCOT_BLOCK contains color codes', () => {
    expect(MASCOT_BLOCK).toContain('\x1b[38;2;32;138;174m');
    expect(MASCOT_BLOCK).toContain('\x1b[38;2;160;160;160m');
  });

  test('MASCOT_DRAWING contains color tags', () => {
    expect(MASCOT_DRAWING).toContain('#208AAE-fg');
  });
});

describe('StreamRenderer', () => {
  test('appends tokens to buffer', () => {
    const pane = { content: '', setContent(s: string) { this.content = s; } };
    const renderer = createStreamRenderer(pane as never);
    renderer.appendToken('hello');
    renderer.appendToken(' world');
    expect(renderer.getBuffer()).toBe('hello world');
  });

  test('clear resets buffer', () => {
    const pane = { content: '', setContent(s: string) { this.content = s; } };
    const renderer = createStreamRenderer(pane as never);
    renderer.appendToken('hello');
    renderer.clear();
    expect(renderer.getBuffer()).toBe('');
  });

  test('strips unauthorized ANSI', () => {
    const pane = { content: '', setContent(s: string) { this.content = s; } };
    const renderer = createStreamRenderer(pane as never);
    renderer.appendToken('\x1b[31mred\x1b[0m');
    expect(renderer.getBuffer()).toBe('red');
  });
});

describe('Overlays', () => {
  test.skip('command palette toggle - requires terminal', () => {});
  test.skip('command palette fuzzy search - requires terminal', () => {});
  test.skip('file picker - requires terminal', () => {});
});
