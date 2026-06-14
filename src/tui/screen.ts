import blessed from 'neo-blessed';

export function createScreen(): blessed.Widgets.Screen {
  const screen = blessed.screen({
    smartCSR: true,
    mouse: true,
    title: 'Kairos Code',
    fullUnicode: true,
    dockBorders: true,
    ignoreLocked: ['C-c', 'C-q'],
  });

  return screen;
}
