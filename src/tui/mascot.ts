import blessed from "neo-blessed";
import type { Theme } from "./themes.ts";

const KAIROS_COLOR: [number, number, number] = [32, 138, 174];
const CODE_COLOR: [number, number, number] = [160, 160, 160];
const BRIGHT_KAIROS: [number, number, number] = [100, 200, 240];
const BRIGHT_CODE: [number, number, number] = [220, 220, 220];

function rgbToAnsi(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function renderColor(c: [number, number, number]): string {
  return rgbToAnsi(c[0], c[1], c[2]);
}

const KAIROS_LINES = [
  "██   ██  █████  ██ ██████   ██████  ███████",
  "██  ██  ██   ██ ██ ██   ██ ██    ██ ██",
  "█████   ███████ ██ ██████  ██    ██ ███████",
  "██  ██  ██   ██ ██ ██   ██ ██    ██      ██",
  "██   ██ ██   ██ ██ ██   ██  ██████  ███████",
];

const CODE_LINES = [
  "  ██████  ██████  ██████  ███████",
  " ██      ██    ██ ██   ██ ██",
  " ██      ██    ██ ██   ██ █████",
  " ██      ██    ██ ██   ██ ██",
  "  ██████  ██████  ██████  ███████",
];

const ANSI_BOLD = "\x1b[1m";
const ANSI_RESET_BOLD = "\x1b[22m";

function renderFrame(shinePos: number, active: boolean): string {
  const lines: string[] = [];

  lines.push(`${renderColor(KAIROS_COLOR)}${ANSI_BOLD}`);

  for (let i = 0; i < KAIROS_LINES.length; i++) {
    if (!active) {
      lines.push(KAIROS_LINES[i]!);
      continue;
    }

    const line = KAIROS_LINES[i]!;
    let result = "";

    for (let j = 0; j < line.length; j++) {
      const dist = Math.abs(j - shinePos);
      if (dist < 4) {
        const t = 1 - dist / 4;
        const c = lerpColor(KAIROS_COLOR, BRIGHT_KAIROS, t);
        result += renderColor(c);
      } else {
        result += renderColor(KAIROS_COLOR);
      }
      result += line[j];
    }
    lines.push(result);
  }

  lines.push(`${ANSI_RESET_BOLD}`);
  lines.push(renderColor(CODE_COLOR));

  for (let i = 0; i < CODE_LINES.length; i++) {
    if (!active) {
      lines.push(CODE_LINES[i]!);
      continue;
    }

    const line = CODE_LINES[i]!;
    let result = "";

    for (let j = 0; j < line.length; j++) {
      const dist = Math.abs(j - shinePos - 10);
      if (dist < 4) {
        const t = 1 - dist / 4;
        const c = lerpColor(CODE_COLOR, BRIGHT_CODE, t);
        result += renderColor(c);
      } else {
        result += renderColor(CODE_COLOR);
      }
      result += line[j];
    }
    lines.push(result);
  }

  lines.push("\x1b[0m");
  return lines.join("\n");
}

export const MASCOT_BLOCK = renderFrame(-10, false);

export const MASCOT_DRAWING = `{#208AAE-fg}{bold}
▗▖ ▗▖  ▗▄▖  ▗▄▄▄▖ ▗▄▖  ▗▄▄▖
▐▌▗▞▘ ▐▌ ▐▌   █   ▐▌ ▐▌▐▌
▐▛▚▖  ▐▛▀▜▌   █   ▐▛▀▚▖▐▌ ▐▌
▐▌ ▐▌ ▐▌ ▐▌ ▗▄█▄▖ ▐▌ ▐▌▝▚▄▞▘
{/bold}{/}
{#A0A0A0-fg}
  ▗▄▄▖ ▗▄▖ ▗▄▄▄  ▗▄▄▄▖
 ▐▌   ▐▌ ▐▌▐▌  █ ▐▌
 ▐▌   ▐▌ ▐▌▐▛▀▀▘ ▐▛▀▀▘
 ▝▚▄▄▖▝▚▄▞▘▐▙▄▄▀ ▐▙▄▄▖
{/}`;

export const MASCOT_ANSI = `\x1b[38;2;32;138;174m
██   ██  █████  ██ ██████   ██████  ███████
██  ██  ██   ██ ██ ██   ██ ██    ██ ██
█████   ███████ ██ ██████  ██    ██ ███████
██  ██  ██   ██ ██ ██   ██ ██    ██      ██
██   ██ ██   ██ ██ ██   ██  ██████  ███████
\x1b[38;2;160;160;160m
  ██████  ██████  ██████  ███████
 ██      ██    ██ ██   ██ ██
 ██      ██    ██ ██   ██ █████
 ██      ██    ██ ██   ██ ██
  ██████  ██████  ██████  ███████
\x1b[0m`;

export const MASCOT_DRAWING_ANSI = `\x1b[38;2;32;138;174m
▗▖ ▗▖  ▗▄▖   ▗▄▄▄▖ ▗▄▄▖  ▗▄▖   ▗▄▖
▐▌▗▞▘ ▐▌ ▐▌   █   ▐▌ ▐▌▐▌ ▐▌▐▌
▐▛▚▖  ▐▛▀▜▌   █   ▐▛▀▚▖▐▌ ▐▌ ▝▀▚▖
▐▌ ▐▌ ▐▌ ▐▌ ▗▄█▄▖ ▐▌ ▐▌▝▚▄▞▘▗▄▄▞▘
\x1b[38;2;160;160;160m
  ▗▄▄▖ ▗▄▖ ▗▄▄▄  ▗▄▄▄▖
 ▐▌   ▐▌ ▐▌▐▌  █ ▐▌
 ▐▌   ▐▌ ▐▌▐▌  █ ▐▛▀▀▘
 ▝▚▄▄▖▝▚▄▞▘▐▙▄▄▀ ▐▙▄▄▖
\x1b[0m`;

export function createMascotBox(
  parent: blessed.Widgets.Node,
  theme: Theme,
): {
  widget: blessed.Widgets.BoxElement;
  setContent(c: string): void;
  show(): void;
  hide(): void;
  startAnimation(): void;
  stopAnimation(): void;
  setActive(active: boolean): void;
} {
  const widget = blessed.box({
    parent,
    top: "center",
    left: "center",
    width: "shrink",
    height: "shrink",
    tags: false,
    content: MASCOT_BLOCK,
    style: { fg: theme.fg, bg: theme.bg },
  });

  let animationTimer: ReturnType<typeof setInterval> | null = null;
  let shinePosition = -10;
  let isActive = false;

  function updateFrame() {
    if (isActive) {
      shinePosition += 2;
      if (shinePosition > 60) {
        shinePosition = -10;
      }
    }
    widget.setContent(renderFrame(shinePosition, isActive));
  }

  return {
    widget,
    setContent(c: string) {
      widget.setContent(c);
    },
    show() {
      widget.show();
    },
    hide() {
      widget.hide();
    },
    setActive(active: boolean) {
      isActive = active;
    },
    startAnimation() {
      if (animationTimer) return;
      shinePosition = -10;
      animationTimer = setInterval(updateFrame, 15000);
      updateFrame();
    },
    stopAnimation() {
      if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
      }
      widget.setContent(renderFrame(-10, false));
    },
  };
}
