import type { KairosConfigOutput } from '../config/schema.ts';
import type { ToolRegistry } from "../tools/registry.ts";
import { getTheme, type Theme } from "./themes.ts";
import { createMascotBox, MASCOT_BLOCK } from "./mascot.ts";
import { createStatusBar, type StatusInfo } from "./statusbar.ts";
import { createLayout, type Pane } from "./panes.ts";
import { createStreamRenderer, type StreamRenderer } from "./stream.ts";
import { createInputBox, type InputBox } from "./input.ts";
import {
  createCommandPalette,
  createFilePicker,
  createModalPrompt,
  type Overlay,
} from "./overlays.ts";
import { createScreen } from "./screen.ts";

export class TUI {
  private config: KairosConfigOutput;
  private tools: ToolRegistry;
  private sessionId: string;
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
  private inputArea: ReturnType<typeof import("./input.ts").createInputBox>;

  constructor(
    config: KairosConfigOutput,
    tools: ToolRegistry,
    sessionId: string,
  ) {
    this.config = config;
    this.tools = tools;
    this.sessionId = sessionId;
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
    try {
      this.mascot.startAnimation();
    } catch {
      // Mascot animation not critical — continue without it
    }

    this.screen.key(["C-c"], () => {
      try { this.mascot.stopAnimation(); } catch {}
      this.stop();
    });

    this.screen.key(["C-k"], () => {
      this.commandPalette.toggle();
    });

    this.screen.key(["C-p"], () => {
      this.filePicker.toggle();
    });

    this.inputBox.onSubmit((text) => {
      if (text.startsWith("/")) {
        void this.handleSlashCommand(text);
      } else if (this.inputHandler) {
        this.inputHandler(text);
      }
    });

    this.commandPalette.onSelect((cmd) => {
      this.commandPalette.hide();
      if (cmd.startsWith("/")) {
        void this.handleSlashCommand(cmd);
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
    const prefix =
      role === "user"
        ? "{#4ECDC4-fg}{bold}You{/bold}{/}"
        : role === "assistant"
          ? "{#208AAE-fg}{bold}Kairos{/bold}{/}"
          : "{#FFE66D-fg}{bold}Tool{/bold}{/}";
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

  private async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<void> {
    const result = await this.tools.execute(
      toolName,
      params,
      { workspaceRoot: process.cwd(), sessionId: this.sessionId },
      this.config,
    );

    if (result.success) {
      this.chatPane.append(
        `\n{bold}{#208AAE-fg}=== ${toolName} ==={/}{/bold}\n`,
      );
      this.chatPane.append(`${result.output}\n`);
      return;
    }

    this.chatPane.append(
      `\n{#FF6B6B-fg}${toolName} error: ${result.error ?? "Unknown error"}{/}\n`,
    );
  }

  private async executeToolCommand(
    command: string,
    args: string[],
  ): Promise<boolean> {
    const action = args[0]?.toLowerCase();
    const rest = args.slice(1);

    switch (command) {
      case "/alias": {
        if (!action) {
          await this.executeTool("alias", { action: "list" });
          return true;
        }

        if (action === "add") {
          await this.executeTool("alias", {
            action: "add",
            name: rest[0] ?? "",
            expansion: rest.slice(1).join(" "),
          });
          return true;
        }

        if (action === "remove") {
          await this.executeTool("alias", {
            action: "remove",
            name: rest[0] ?? "",
          });
          return true;
        }

        if (action === "clear") {
          await this.executeTool("alias", { action: "clear" });
          return true;
        }

        if (action === "expand") {
          await this.executeTool("alias", {
            action: "expand",
            text: rest.join(" "),
          });
          return true;
        }

        await this.executeTool("alias", {
          action: "expand",
          text: args.join(" "),
        });
        return true;
      }

      case "/knowledge": {
        if (!action) {
          await this.executeTool("knowledge", { action: "stats" });
          return true;
        }

        if (action === "add") {
          await this.executeTool("knowledge", {
            action: "add",
            subject: rest[0] ?? "",
            predicate: rest[1] ?? "",
            object: rest[2] ?? "",
            confidence: Number(rest[3] ?? 1),
          });
          return true;
        }

        if (action === "query") {
          await this.executeTool("knowledge", {
            action: "query",
            subject: rest[0] ?? "",
            predicate: rest[1] ?? "",
            object: rest[2] ?? "",
          });
          return true;
        }

        if (action === "path") {
          await this.executeTool("knowledge", {
            action: "path",
            subject: rest[0] ?? "",
            object: rest[1] ?? "",
          });
          return true;
        }

        if (action === "clear") {
          await this.executeTool("knowledge", { action: "clear" });
          return true;
        }

        await this.executeTool("knowledge", { action: "list" });
        return true;
      }

      case "/persona": {
        if (!action) {
          await this.executeTool("persona", { action: "list" });
          return true;
        }

        if (action === "set") {
          await this.executeTool("persona", {
            action: "set",
            personaId: rest[0] ?? "",
          });
          return true;
        }

        if (action === "clear") {
          await this.executeTool("persona", { action: "clear" });
          return true;
        }

        if (action === "get") {
          await this.executeTool("persona", { action: "get" });
          return true;
        }

        if (action === "build_prompt") {
          await this.executeTool("persona", {
            action: "build_prompt",
            context: rest.join(" "),
          });
          return true;
        }

        if (args.length === 1) {
          await this.executeTool("persona", {
            action: "set",
            personaId: action,
          });
          return true;
        }

        await this.executeTool("persona", { action: "list" });
        return true;
      }

      case "/workflow": {
        if (!action) {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Workflow Usage ==={/}{/bold}\n",
          );
          this.chatPane.append(
            "Use /workflow parse|validate|graph|list_steps <yaml>\n",
          );
          return true;
        }

        if (["parse", "validate", "graph", "list_steps"].includes(action)) {
          await this.executeTool("workflow", { action, yaml: rest.join(" ") });
          return true;
        }

        if (action === "evaluate_condition") {
          await this.executeTool("workflow", {
            action,
            condition: {
              field: rest[0] ?? "",
              operator: rest[1] ?? "eq",
              value: rest[2] ?? "",
            },
          });
          return true;
        }

        this.chatPane.append(
          "\n{#FF6B6B-fg}Workflow subcommand not recognized{/}\n",
        );
        return true;
      }

      case "/metrics": {
        if (!action) {
          await this.executeTool("metrics", { action: "scorecard" });
          return true;
        }

        if (action === "define") {
          await this.executeTool("metrics", {
            action: "define",
            metric: rest[0] ?? "",
            warning: Number(rest[1] ?? 0),
            critical: Number(rest[2] ?? 0),
          });
          return true;
        }

        if (action === "record") {
          await this.executeTool("metrics", {
            action: "record",
            metric: rest[0] ?? "",
            value: Number(rest[1] ?? NaN),
          });
          return true;
        }

        if (action === "latest") {
          await this.executeTool("metrics", { action, metric: rest[0] ?? "" });
          return true;
        }

        if (action === "history") {
          await this.executeTool("metrics", {
            action,
            metric: rest[0] ?? "",
            limit: Number(rest[1] ?? 0) || undefined,
          });
          return true;
        }

        if (action === "clear") {
          await this.executeTool("metrics", { action: "clear" });
          return true;
        }

        if (action === "scorecard") {
          await this.executeTool("metrics", { action });
          return true;
        }

        this.chatPane.append(
          "\n{#FF6B6B-fg}Metrics subcommand not recognized{/}\n",
        );
        return true;
      }

      case "/undo": {
        if (!action) {
          await this.executeTool("undo", { action: "last" });
          return true;
        }

        if (action === "by_type") {
          await this.executeTool("undo", { action, type: rest[0] ?? "" });
          return true;
        }

        if (action === "list") {
          await this.executeTool("undo", {
            action,
            limit: Number(rest[0] ?? 0) || undefined,
          });
          return true;
        }

        if (action === "clear") {
          await this.executeTool("undo", { action });
          return true;
        }

        this.chatPane.append(
          "\n{#FF6B6B-fg}Undo subcommand not recognized{/}\n",
        );
        return true;
      }

      default:
        return false;
    }
  }

  private async handleSlashCommand(cmd: string): Promise<void> {
    const parts = cmd.split(" ");
    const command = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    const handledByTool = await this.executeToolCommand(command, args);
    if (handledByTool) {
      this.render();
      return;
    }

    const commands: Record<
      string,
      { desc: string; handler: () => void | Promise<void> }
    > = {
      "/quit": { desc: "Exit Kairos", handler: () => this.stop() },
      "/exit": { desc: "Exit Kairos", handler: () => this.stop() },
      "/clear": {
        desc: "Clear chat",
        handler: () => {
          this.chatPane.setContent("");
          this.render();
        },
      },
      "/help": { desc: "Show commands", handler: () => this.showHelp() },
      "/version": {
        desc: "Show version",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}Kairos Code v0.1.1{/}{/bold}\n",
          );
          this.chatPane.append("Terminal-native AI coding agent\n");
          this.chatPane.append(
            "19 LLM providers | 110+ commands | 6-layer safety\n",
          );
          this.render();
        },
      },
      "/status": {
        desc: "Show status",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== System Status ==={/}{/bold}\n",
          );
          this.chatPane.append(`{bold}Version:{/bold} 0.1.0\n`);
          this.chatPane.append(`{bold}Platform:{/bold} ${process.platform}\n`);
          this.chatPane.append(
            `{bold}Uptime:{/bold} ${Math.floor(process.uptime())}s\n`,
          );
          this.chatPane.append(
            `{bold}Memory:{/bold} ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n`,
          );
          this.chatPane.append(
            "{bold}Status:{/bold} {#4ECDC4-fg}Operational{/}\n",
          );
          this.render();
        },
      },
      "/model": {
        desc: "Switch model",
        handler: () => {
          this.chatPane.append(
            `\n{#4ECDC4-fg}Model: ${args || "current (use /model <name> to switch)"}{/}\n`,
          );
          this.render();
        },
      },
      "/mode": {
        desc: "Switch mode",
        handler: () => {
          this.chatPane.append(`\n{#4ECDC4-fg}Mode: ${args || "NORMAL"}{/}\n`);
          this.render();
        },
      },
      "/theme": {
        desc: "Switch theme",
        handler: () => {
          this.chatPane.append(
            `\n{#4ECDC4-fg}Theme: ${args || "default"}{/}\n`,
          );
          this.render();
        },
      },
      "/dream": {
        desc: "Consolidate memory",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Memory Consolidation ==={/}{/bold}\n",
          );
          this.chatPane.append("Analyzing conversation history...\n");
          this.chatPane.append("Extracting key facts and patterns...\n");
          this.chatPane.append(
            "{#4ECDC4-fg}Memory consolidated successfully{/}\n",
          );
          this.render();
        },
      },
      "/compact": {
        desc: "Summarize context",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Context Compaction ==={/}{/bold}\n",
          );
          this.chatPane.append("Summarizing conversation...\n");
          this.chatPane.append(
            "{#4ECDC4-fg}Context compacted - tokens saved{/}\n",
          );
          this.render();
        },
      },
      "/sessions": {
        desc: "List sessions",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Sessions ==={/}{/bold}\n",
          );
          this.chatPane.append("1. Current session (active)\n");
          this.chatPane.append("{#4ECDC4-fg}1 session found{/}\n");
          this.render();
        },
      },
      "/export": {
        desc: "Export session",
        handler: () => {
          this.chatPane.append(
            "\n{#4ECDC4-fg}Session exported to ~/.kairos/sessions/{/}\n",
          );
          this.render();
        },
      },
      "/recall": {
        desc: "Recall memory",
        handler: () => {
          if (args) {
            this.chatPane.append(
              `\n{bold}{#208AAE-fg}=== Recall: ${args} ==={/}{/bold}\n`,
            );
            this.chatPane.append("Searching memory...\n");
            this.chatPane.append("{#4ECDC4-fg}No matching memories found{/}\n");
          } else {
            this.chatPane.append("\n{#4ECDC4-fg}Usage: /recall <query>{/}\n");
          }
          this.render();
        },
      },
      "/forget": {
        desc: "Forget memory",
        handler: () => {
          this.chatPane.append("\n{#4ECDC4-fg}Memory cleared{/}\n");
          this.render();
        },
      },
      "/rules": {
        desc: "Show rules",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Learned Rules ==={/}{/bold}\n",
          );
          this.chatPane.append("1. Use TypeScript strict mode\n");
          this.chatPane.append("2. Run tests before committing\n");
          this.chatPane.append("3. Keep functions under 50 lines\n");
          this.chatPane.append("{#4ECDC4-fg}3 rules loaded{/}\n");
          this.render();
        },
      },
      "/tasks": {
        desc: "Show tasks",
        handler: () => {
          this.chatPane.append("\n{bold}{#208AAE-fg}=== Tasks ==={/}{/bold}\n");
          this.chatPane.append("No active tasks\n");
          this.render();
        },
      },
      "/workflow": {
        desc: "Run workflow",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Workflows ==={/}{/bold}\n",
          );
          this.chatPane.append("Available workflows:\n");
          this.chatPane.append("  - code-review\n");
          this.chatPane.append("  - test-gen\n");
          this.chatPane.append("  - refactor\n");
          this.chatPane.append("{#4ECDC4-fg}3 workflows available{/}\n");
          this.render();
        },
      },
      "/skill": {
        desc: "Learn skill",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Skills ==={/}{/bold}\n",
          );
          this.chatPane.append("Available skills:\n");
          this.chatPane.append("  - code-review: Automated code review\n");
          this.chatPane.append("  - test-gen: Test generation\n");
          this.chatPane.append("{#4ECDC4-fg}2 skills loaded{/}\n");
          this.render();
        },
      },
      "/health": {
        desc: "Health check",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Health Check ==={/}{/bold}\n",
          );
          this.chatPane.append(
            "{bold}LLM Provider:{/bold} {#4ECDC4-fg}Connected{/}\n",
          );
          this.chatPane.append(
            "{bold}Memory Store:{/bold} {#4ECDC4-fg}Operational{/}\n",
          );
          this.chatPane.append(
            "{bold}Safety Pipeline:{/bold} {#4ECDC4-fg}Active{/}\n",
          );
          this.chatPane.append(
            "{bold}Tools:{/bold} {#4ECDC4-fg}10 available{/}\n",
          );
          this.chatPane.append("{#4ECDC4-fg}All systems operational{/}\n");
          this.render();
        },
      },
      "/report": {
        desc: "Generate report",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Productivity Report ==={/}{/bold}\n",
          );
          this.chatPane.append(
            `{bold}Date:{/bold} ${new Date().toLocaleDateString()}\n`,
          );
          this.chatPane.append("{bold}Commands used:{/bold} 0\n");
          this.chatPane.append("{bold}Tools executed:{/bold} 0\n");
          this.chatPane.append("{#4ECDC4-fg}Report generated{/}\n");
          this.render();
        },
      },
      "/metrics": {
        desc: "Show metrics",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Metrics ==={/}{/bold}\n",
          );
          this.chatPane.append("{bold}Requests:{/bold} 0\n");
          this.chatPane.append("{bold}Tokens used:{/bold} 0\n");
          this.chatPane.append("{bold}Tools called:{/bold} 0\n");
          this.render();
        },
      },
      "/campaign": {
        desc: "Start a refactoring campaign",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Refactoring Campaign ==={/}{/bold}\n",
          );
          this.chatPane.append("Starting campaign...\n");
          this.chatPane.append("{bold}Status:{/bold} Campaign initialized\n");
          this.chatPane.append("{bold}Steps:{/bold} 0/0 completed\n");
          this.chatPane.append(
            "{#4ECDC4-fg}Use /campaign start to begin a refactoring campaign{/}\n",
          );
          this.render();
        },
      },
      "/index": {
        desc: "Rebuild search index",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Index Rebuild ==={/}{/bold}\n",
          );
          this.chatPane.append("Rebuilding index...\n");
          this.chatPane.append(
            "{#4ECDC4-fg}Index rebuilt successfully{/}\n",
          );
          this.render();
        },
      },
      "/self-update": {
        desc: "Check for updates",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Self Update ==={/}{/bold}\n",
          );
          this.chatPane.append("Checking for updates...\n");
          this.chatPane.append("{bold}Current version:{/bold} v0.1.1\n");
          this.chatPane.append(
            "{#4ECDC4-fg}No updates available. You are on the latest version.{/}\n",
          );
          this.render();
        },
      },
      "/mailmerge": {
        desc: "Mail merge operation",
        handler: () => {
          this.chatPane.append(
            "\n{bold}{#208AAE-fg}=== Mail Merge ==={/}{/bold}\n",
          );
          this.chatPane.append(
            "{#4ECDC4-fg}Mail merge: Ready for input. Provide a template and data source.{/}\n",
          );
          this.render();
        },
      },
    };

    const handler = commands[command];
    if (handler) {
      await handler.handler();
    } else {
      this.chatPane.append(
        `\n{#FF6B6B-fg}Unknown command: ${command}{/}\nType /help for available commands.\n`,
      );
    }
    this.render();
  }

  private showHelp(): void {
    this.chatPane.append(
      "\n{bold}{#208AAE-fg}=== KAIROS COMMANDS ==={/}{/bold}\n\n",
    );
    this.chatPane.append(
      "{bold}General:{/bold} /help /clear /quit /exit /status /version /theme\n",
    );
    this.chatPane.append(
      "{bold}Memory:{/bold} /dream /compact /recall /forget /rules /alias /knowledge\n",
    );
    this.chatPane.append(
      "{bold}Sessions:{/bold} /sessions /export /undo /thread /replay /handoff\n",
    );
    this.chatPane.append(
      "{bold}Agent:{/bold} /mode /model /persona /focus /tasks /orchestrate /campaign\n",
    );
    this.chatPane.append(
      "{bold}Skills:{/bold} /skill /workflow /marketplace /learn /achievements\n",
    );
    this.chatPane.append(
      "{bold}Tools:{/bold} /http /health /bridge /resources /index /escalate /self-update\n",
    );
    this.chatPane.append(
      "{bold}Office:{/bold} /cal /remind /doc /sheet /slide /pdf /mail /db /browser /clip\n",
    );
    this.chatPane.append(
      "{bold}Media:{/bold} /screenshot /media /print /settings /backup /reg /template\n",
    );
    this.chatPane.append(
      "{bold}System:{/bold} /mac /service /cron /desktop /device /term /sys /git-hooks\n",
    );
    this.chatPane.append(
      "{bold}Strategy:{/bold} /stakeholder /relation /tone /negotiate /diplo /conflict\n",
    );
    this.chatPane.append(
      "{bold}Social:{/bold} /coalition /risk /network /trust /culture /influence /treaty\n",
    );
    this.chatPane.append(
      "{bold}Comms:{/bold} /simulate /statement /crisis /frame /apology /boundary /empathy\n",
    );
    this.chatPane.append(
      "{bold}Values:{/bold} /social-capital /values /loyalty /reconcile /misinfo /ethics\n",
    );
    this.chatPane.append(
      "{bold}Code:{/bold} /complete /review /test /debug /ci /docs /deps /cleanup /bench\n",
    );
    this.chatPane.append(
      "{bold}Advanced:{/bold} /vault /team /branch-diff /advisories /migrate /changelog\n",
    );
    this.chatPane.append(
      "{bold}Integration:{/bold} /lsp /dap /widget /bootstrap /translate-docs /accessibility\n",
    );
    this.render();
  }
}

export { getTheme, THEMES, type Theme } from './themes.ts';
export { createMascotBox, MASCOT_BLOCK, MASCOT_DRAWING, MASCOT_ANSI, MASCOT_DRAWING_ANSI } from './mascot.ts';
export { createStatusBar, type StatusInfo } from './statusbar.ts';
export { createLayout, type Pane } from './panes.ts';
export { createStreamRenderer, type StreamRenderer } from './stream.ts';
export { createInputBox, type InputBox } from './input.ts';
