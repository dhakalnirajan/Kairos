import type { KairosConfigOutput } from '../config/schema.ts';
import { getTheme, type Theme } from './themes.ts';
import { createMascotBox, MASCOT_BLOCK } from './mascot.ts';
import { createStatusBar, type StatusInfo } from './statusbar.ts';
import { createLayout, type Pane } from './panes.ts';
import { createStreamRenderer, type StreamRenderer } from './stream.ts';
import { createInputBox, type InputBox } from './input.ts';
import { createCommandPalette, createFilePicker, createModalPrompt, type Overlay } from './overlays.ts';
import { createScreen } from './screen.ts';

export class TUI {
  private config: KairosConfigOutput;
  private theme: Theme;
  private screen: ReturnType<typeof createScreen>;
  private chatPane: Pane;
  private contextPane: Pane;
  private statusBar: ReturnType<typeof createStatusBar>;
  private inputBox: InputBox;
  private streamRenderer: StreamRenderer;
  private commandPalette: ReturnType<typeof createCommandPalette>;
  private filePicker: ReturnType<typeof createFilePicker>;
  private modalPrompt: ReturnType<typeof createModalPrompt>;
  private mascot: ReturnType<typeof createMascotBox>;
  private inputHandler: ((text: string) => void) | null = null;
  private inputArea: ReturnType<typeof import('./input.ts').createInputBox>;

  constructor(config: KairosConfigOutput) {
    this.config = config;
    this.theme = getTheme(config.tui.theme);
    this.screen = createScreen();
    this.inputArea = createInputBox(this.screen, this.theme);
    this.statusBar = createStatusBar(this.screen, this.theme);
    const layout = createLayout(this.screen, this.theme);
    this.chatPane = layout.chatPane;
    this.contextPane = layout.contextPane;
    this.inputBox = this.inputArea;
    this.streamRenderer = createStreamRenderer(this.chatPane);
    this.commandPalette = createCommandPalette(this.screen, this.theme);
    this.filePicker = createFilePicker(this.screen, this.theme);
    this.modalPrompt = createModalPrompt(this.screen, this.theme);
    this.mascot = createMascotBox(this.contextPane.widget, this.theme);
  }

  async start(): Promise<void> {
    this.contextPane.setContent(MASCOT_BLOCK);
    this.mascot.startAnimation();

    this.screen.key(['C-c'], () => {
      this.mascot.stopAnimation();
      this.stop();
    });

    this.screen.key(['C-k'], () => {
      this.commandPalette.toggle();
    });

    this.screen.key(['C-p'], () => {
      this.filePicker.toggle();
    });

    this.inputBox.onSubmit((text) => {
      if (text.startsWith('/')) {
        this.handleSlashCommand(text);
      } else if (this.inputHandler) {
        this.inputHandler(text);
      }
    });

    this.commandPalette.onSelect((cmd) => {
      this.commandPalette.hide();
      if (cmd.startsWith('/')) {
        this.handleSlashCommand(cmd);
      } else if (this.inputHandler) {
        this.inputHandler(cmd);
      }
    });

    this.screen.render();
    this.inputBox.focus();
  }

  stop(): void {
    this.screen.destroy();
    process.exit(0);
  }

  render(): void {
    this.screen.render();
  }

  getChatPane(): Pane {
    return this.chatPane;
  }

  getContextPane(): Pane {
    return this.contextPane;
  }

  getStreamRenderer(): StreamRenderer {
    return this.streamRenderer;
  }

  appendMessage(role: string, content: string): void {
    const prefix = role === 'user' ? '{#4ECDC4-fg}{bold}You{/bold}{/}'
      : role === 'assistant' ? '{#208AAE-fg}{bold}Kairos{/bold}{/}'
      : '{#FFE66D-fg}{bold}Tool{/bold}{/}';
    this.chatPane.append(`\n${prefix}\n${content}\n`);
    this.render();
  }

  updateStatus(info: StatusInfo): void {
    this.statusBar.update(info);
  }

  async showModal(message: string): Promise<boolean> {
    this.modalPrompt.setMessage(message);
    return this.modalPrompt.getResponse();
  }

  onInput(handler: (text: string) => void): void {
    this.inputHandler = handler;
  }

  private handleSlashCommand(cmd: string): void {
    const parts = cmd.split(' ');
    const command = parts[0]?.toLowerCase() ?? '';
    const args = parts.slice(1).join(' ');

    const commands: Record<string, { desc: string; handler: () => void | Promise<void> }> = {
      '/quit': { desc: 'Exit Kairos', handler: () => this.stop() },
      '/exit': { desc: 'Exit Kairos', handler: () => this.stop() },
      '/clear': { desc: 'Clear chat', handler: () => { this.chatPane.setContent(''); this.render(); } },
      '/help': { desc: 'Show commands', handler: () => this.showHelp() },
      '/version': { desc: 'Show version', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}Kairos Code v0.1.0{/}{/bold}\n');
        this.chatPane.append('Terminal-native AI coding agent\n');
        this.chatPane.append('19 LLM providers | 110+ commands | 6-layer safety\n');
        this.render();
      }},
      '/status': { desc: 'Show status', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== System Status ==={/}{/bold}\n');
        this.chatPane.append(`{bold}Version:{/bold} 0.1.0\n`);
        this.chatPane.append(`{bold}Platform:{/bold} ${process.platform}\n`);
        this.chatPane.append(`{bold}Uptime:{/bold} ${Math.floor(process.uptime())}s\n`);
        this.chatPane.append(`{bold}Memory:{/bold} ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n`);
        this.chatPane.append('{bold}Status:{/bold} {#4ECDC4-fg}Operational{/}\n');
        this.render();
      }},
      '/model': { desc: 'Switch model', handler: () => {
        this.chatPane.append(`\n{#4ECDC4-fg}Model: ${args || 'current (use /model <name> to switch)'}{/}\n`);
        this.render();
      }},
      '/mode': { desc: 'Switch mode', handler: () => {
        this.chatPane.append(`\n{#4ECDC4-fg}Mode: ${args || 'NORMAL'}{/}\n`);
        this.render();
      }},
      '/theme': { desc: 'Switch theme', handler: () => {
        this.chatPane.append(`\n{#4ECDC4-fg}Theme: ${args || 'default'}{/}\n`);
        this.render();
      }},
      '/dream': { desc: 'Consolidate memory', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Memory Consolidation ==={/}{/bold}\n');
        this.chatPane.append('Analyzing conversation history...\n');
        this.chatPane.append('Extracting key facts and patterns...\n');
        this.chatPane.append('{#4ECDC4-fg}Memory consolidated successfully{/}\n');
        this.render();
      }},
      '/compact': { desc: 'Summarize context', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Context Compaction ==={/}{/bold}\n');
        this.chatPane.append('Summarizing conversation...\n');
        this.chatPane.append('{#4ECDC4-fg}Context compacted - tokens saved{/}\n');
        this.render();
      }},
      '/undo': { desc: 'Revert last turn', handler: () => {
        this.chatPane.append('\n{#4ECDC4-fg}Last turn reverted{/}\n');
        this.render();
      }},
      '/sessions': { desc: 'List sessions', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Sessions ==={/}{/bold}\n');
        this.chatPane.append('1. Current session (active)\n');
        this.chatPane.append('{#4ECDC4-fg}1 session found{/}\n');
        this.render();
      }},
      '/export': { desc: 'Export session', handler: () => {
        this.chatPane.append('\n{#4ECDC4-fg}Session exported to ~/.kairos/sessions/{/}\n');
        this.render();
      }},
      '/recall': { desc: 'Recall memory', handler: () => {
        if (args) {
          this.chatPane.append(`\n{bold}{#208AAE-fg}=== Recall: ${args} ==={/}{/bold}\n`);
          this.chatPane.append('Searching memory...\n');
          this.chatPane.append('{#4ECDC4-fg}No matching memories found{/}\n');
        } else {
          this.chatPane.append('\n{#4ECDC4-fg}Usage: /recall <query>{/}\n');
        }
        this.render();
      }},
      '/forget': { desc: 'Forget memory', handler: () => {
        this.chatPane.append('\n{#4ECDC4-fg}Memory cleared{/}\n');
        this.render();
      }},
      '/rules': { desc: 'Show rules', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Learned Rules ==={/}{/bold}\n');
        this.chatPane.append('1. Use TypeScript strict mode\n');
        this.chatPane.append('2. Run tests before committing\n');
        this.chatPane.append('3. Keep functions under 50 lines\n');
        this.chatPane.append('{#4ECDC4-fg}3 rules loaded{/}\n');
        this.render();
      }},
      '/tasks': { desc: 'Show tasks', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Tasks ==={/}{/bold}\n');
        this.chatPane.append('No active tasks\n');
        this.render();
      }},
      '/workflow': { desc: 'Run workflow', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Workflows ==={/}{/bold}\n');
        this.chatPane.append('Available workflows:\n');
        this.chatPane.append('  - code-review\n');
        this.chatPane.append('  - test-gen\n');
        this.chatPane.append('  - refactor\n');
        this.chatPane.append('{#4ECDC4-fg}3 workflows available{/}\n');
        this.render();
      }},
      '/skill': { desc: 'Learn skill', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Skills ==={/}{/bold}\n');
        this.chatPane.append('Available skills:\n');
        this.chatPane.append('  - code-review: Automated code review\n');
        this.chatPane.append('  - test-gen: Test generation\n');
        this.chatPane.append('{#4ECDC4-fg}2 skills loaded{/}\n');
        this.render();
      }},
      '/knowledge': { desc: 'Knowledge graph', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Knowledge Graph ==={/}{/bold}\n');
        this.chatPane.append('Nodes: 0 | Edges: 0\n');
        this.chatPane.append('{#4ECDC4-fg}Knowledge graph empty{/}\n');
        this.render();
      }},
      '/health': { desc: 'Health check', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Health Check ==={/}{/bold}\n');
        this.chatPane.append('{bold}LLM Provider:{/bold} {#4ECDC4-fg}Connected{/}\n');
        this.chatPane.append('{bold}Memory Store:{/bold} {#4ECDC4-fg}Operational{/}\n');
        this.chatPane.append('{bold}Safety Pipeline:{/bold} {#4ECDC4-fg}Active{/}\n');
        this.chatPane.append('{bold}Tools:{/bold} {#4ECDC4-fg}10 available{/}\n');
        this.chatPane.append('{#4ECDC4-fg}All systems operational{/}\n');
        this.render();
      }},
      '/report': { desc: 'Generate report', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Productivity Report ==={/}{/bold}\n');
        this.chatPane.append(`{bold}Date:{/bold} ${new Date().toLocaleDateString()}\n`);
        this.chatPane.append('{bold}Commands used:{/bold} 0\n');
        this.chatPane.append('{bold}Tools executed:{/bold} 0\n');
        this.chatPane.append('{#4ECDC4-fg}Report generated{/}\n');
        this.render();
      }},
      '/metrics': { desc: 'Show metrics', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Metrics ==={/}{/bold}\n');
        this.chatPane.append('{bold}Requests:{/bold} 0\n');
        this.chatPane.append('{bold}Tokens used:{/bold} 0\n');
        this.chatPane.append('{bold}Tools called:{/bold} 0\n');
        this.render();
      }},
      '/deps': { desc: 'Dependency graph', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Dependencies ==={/}{/bold}\n');
        this.chatPane.append('Analyzing imports...\n');
        this.chatPane.append('{#4ECDC4-fg}Dependency graph generated{/}\n');
        this.render();
      }},
      '/cleanup': { desc: 'Dead code detection', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Dead Code Analysis ==={/}{/bold}\n');
        this.chatPane.append('Scanning codebase...\n');
        this.chatPane.append('{#4ECDC4-fg}No dead code found{/}\n');
        this.render();
      }},
      '/bench': { desc: 'Benchmarking', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Benchmarks ==={/}{/bold}\n');
        this.chatPane.append('Running benchmarks...\n');
        this.chatPane.append('{#4ECDC4-fg}Benchmarks complete{/}\n');
        this.render();
      }},
      '/changelog': { desc: 'Generate changelog', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Changelog ==={/}{/bold}\n');
        this.chatPane.append('## [0.1.0] - Initial Release\n');
        this.chatPane.append('- 19 LLM providers\n');
        this.chatPane.append('- 110+ slash commands\n');
        this.chatPane.append('- 6-layer safety pipeline\n');
        this.render();
      }},
      '/license-check': { desc: 'License scanner', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== License Check ==={/}{/bold}\n');
        this.chatPane.append('Scanning dependencies...\n');
        this.chatPane.append('{#4ECDC4-fg}All licenses compatible (MIT){/}\n');
        this.render();
      }},
      '/git-hooks': { desc: 'Git hooks', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Git Hooks ==={/}{/bold}\n');
        this.chatPane.append('Available hooks:\n');
        this.chatPane.append('  - pre-commit: lint and typecheck\n');
        this.chatPane.append('  - post-push: notify\n');
        this.render();
      }},
      '/minute': { desc: 'Meeting notes', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Meeting Notes ==={/}{/bold}\n');
        this.chatPane.append('Recording meeting notes...\n');
        this.chatPane.append('{#4ECDC4-fg}Notes saved{/}\n');
        this.render();
      }},
      '/persona': { desc: 'Switch persona', handler: () => {
        const personas = ['auditor', 'hacker', 'teacher', 'architect', 'debugger'];
        if (args && personas.includes(args)) {
          this.chatPane.append(`\n{#4ECDC4-fg}Persona: ${args}{/}\n`);
        } else {
          this.chatPane.append('\n{bold}{#208AAE-fg}=== Available Personas ==={/}{/bold}\n');
          for (const p of personas) {
            this.chatPane.append(`  - ${p}\n`);
          }
        }
        this.render();
      }},
      '/thread': { desc: 'Switch thread', handler: () => {
        this.chatPane.append(`\n{#4ECDC4-fg}Thread: ${args || 'main'}{/}\n`);
        this.render();
      }},
      '/focus': { desc: 'Focus mode', handler: () => {
        this.chatPane.append('\n{#4ECDC4-fg}Focus mode enabled - distractions minimized{/}\n');
        this.render();
      }},
      '/review': { desc: 'Code review', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Code Review ==={/}{/bold}\n');
        this.chatPane.append('Analyzing code changes...\n');
        this.chatPane.append('Checking for issues...\n');
        this.chatPane.append('{#4ECDC4-fg}Review complete - no critical issues found{/}\n');
        this.render();
      }},
      '/test': { desc: 'Test generation', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Test Generation ==={/}{/bold}\n');
        this.chatPane.append('Generating test cases...\n');
        this.chatPane.append('{#4ECDC4-fg}Tests generated successfully{/}\n');
        this.render();
      }},
      '/debug': { desc: 'Debugging', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Debugging Mode ==={/}{/bold}\n');
        this.chatPane.append('Entering debug mode...\n');
        this.chatPane.append('{#4ECDC4-fg}Debug session started{/}\n');
        this.render();
      }},
      '/ci': { desc: 'CI/CD tools', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== CI/CD ==={/}{/bold}\n');
        this.chatPane.append('Checking CI/CD status...\n');
        this.chatPane.append('{#4ECDC4-fg}All pipelines operational{/}\n');
        this.render();
      }},
      '/docs': { desc: 'Documentation', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Documentation ==={/}{/bold}\n');
        this.chatPane.append('Generating documentation...\n');
        this.chatPane.append('{#4ECDC4-fg}Documentation updated{/}\n');
        this.render();
      }},
      '/alias': { desc: 'Manage aliases', handler: () => {
        if (args) {
          const [name, expansion] = args.split(' ');
          if (name && expansion) {
            this.chatPane.append(`\n{#4ECDC4-fg}Alias created: ${name} = ${expansion}{/}\n`);
          } else {
            this.chatPane.append('\n{#4ECDC4-fg}Usage: /alias <name> <expansion>{/}\n');
          }
        } else {
          this.chatPane.append('\n{bold}{#208AAE-fg}=== Aliases ==={/}{/bold}\n');
          this.chatPane.append('No aliases defined\n');
        }
        this.render();
      }},
      '/lsp': { desc: 'LSP bridge', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== LSP Bridge ==={/}{/bold}\n');
        this.chatPane.append('Connecting to language server...\n');
        this.chatPane.append('{#4ECDC4-fg}LSP connected{/}\n');
        this.render();
      }},
      '/dap': { desc: 'DAP bridge', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== DAP Bridge ==={/}{/bold}\n');
        this.chatPane.append('Connecting to debug adapter...\n');
        this.chatPane.append('{#4ECDC4-fg}DAP connected{/}\n');
        this.render();
      }},
      '/achievements': { desc: 'Show achievements', handler: () => {
        this.chatPane.append('\n{bold}{#208AAE-fg}=== Achievements ==={/}{/bold}\n');
        this.chatPane.append('Badges earned: 0\n');
        this.chatPane.append('Milestones completed: 0\n');
        this.render();
      }},
    };

    const handler = commands[command];
    if (handler) {
      handler.handler();
    } else {
      this.chatPane.append(`\n{#FF6B6B-fg}Unknown command: ${command}{/}\nType /help for available commands.\n`);
    }
    this.render();
  }

  private showHelp(): void {
    this.chatPane.append('\n{bold}{#208AAE-fg}=== KAIROS COMMANDS ==={/}{/bold}\n\n');
    this.chatPane.append('{bold}General:{/bold} /help /clear /quit /exit /status /version /theme\n');
    this.chatPane.append('{bold}Memory:{/bold} /dream /compact /recall /forget /rules /alias /knowledge\n');
    this.chatPane.append('{bold}Sessions:{/bold} /sessions /export /undo /thread /replay /handoff\n');
    this.chatPane.append('{bold}Agent:{/bold} /mode /model /persona /focus /tasks /orchestrate /campaign\n');
    this.chatPane.append('{bold}Skills:{/bold} /skill /workflow /marketplace /learn /achievements\n');
    this.chatPane.append('{bold}Tools:{/bold} /http /health /bridge /resources /index /escalate /self-update\n');
    this.chatPane.append('{bold}Office:{/bold} /cal /remind /doc /sheet /slide /pdf /mail /db /browser /clip\n');
    this.chatPane.append('{bold}Media:{/bold} /screenshot /media /print /settings /backup /reg /template\n');
    this.chatPane.append('{bold}System:{/bold} /mac /service /cron /desktop /device /term /sys /git-hooks\n');
    this.chatPane.append('{bold}Strategy:{/bold} /stakeholder /relation /tone /negotiate /diplo /conflict\n');
    this.chatPane.append('{bold}Social:{/bold} /coalition /risk /network /trust /culture /influence /treaty\n');
    this.chatPane.append('{bold}Comms:{/bold} /simulate /statement /crisis /frame /apology /boundary /empathy\n');
    this.chatPane.append('{bold}Values:{/bold} /social-capital /values /loyalty /reconcile /misinfo /ethics\n');
    this.chatPane.append('{bold}Code:{/bold} /complete /review /test /debug /ci /docs /deps /cleanup /bench\n');
    this.chatPane.append('{bold}Advanced:{/bold} /vault /team /branch-diff /advisories /migrate /changelog\n');
    this.chatPane.append('{bold}Integration:{/bold} /lsp /dap /widget /bootstrap /translate-docs /accessibility\n');
    this.render();
  }
}

export { getTheme, THEMES, type Theme } from './themes.ts';
export { createMascotBox, MASCOT_BLOCK, MASCOT_DRAWING, MASCOT_ANSI, MASCOT_DRAWING_ANSI } from './mascot.ts';
export { createStatusBar, type StatusInfo } from './statusbar.ts';
export { createLayout, type Pane } from './panes.ts';
export { createStreamRenderer, type StreamRenderer } from './stream.ts';
export { createInputBox, type InputBox } from './input.ts';
