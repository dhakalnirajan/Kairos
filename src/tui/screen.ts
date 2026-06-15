import blessed from 'neo-blessed';

export function createScreen(): blessed.Widgets.Screen {
  const screen = blessed.screen({
    smartCSR: true,
    mouse: true,
    title: 'Kairos Code',
    fullUnicode: true,
    dockBorders: true,
    ignoreLocked: ['C-c', 'C-q'],
    style: {
      fg: '#E0E0E0',
      bg: '#1A1A2E',
      bold: false,
    },
  });

  return screen;
}
