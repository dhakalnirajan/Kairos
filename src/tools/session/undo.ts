import type { ToolContext, ToolInstance } from "../../types/tools.ts";

export interface UndoEntry {
  id: string;
  timestamp: number;
  type: "turn" | "tool" | "edit";
  description: string;
  data: Record<string, unknown>;
}

export class UndoManager {
  private entries: UndoEntry[] = [];
  private maxSize = 100;

  addEntry(
    type: UndoEntry["type"],
    description: string,
    data: Record<string, unknown> = {},
  ): string {
    const id = `undo-${Date.now()}`;
    this.entries.push({
      id,
      timestamp: Date.now(),
      type,
      description,
      data,
    });

    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }

    return id;
  }

  undo(lastN: number = 1): UndoEntry | null {
    if (this.entries.length < lastN) return null;
    return this.entries.splice(-lastN)[0] ?? null;
  }

  undoByType(type: UndoEntry["type"]): UndoEntry | null {
    const idx = this.entries.findLastIndex((e) => e.type === type);
    if (idx >= 0) {
      return this.entries.splice(idx, 1)[0] ?? null;
    }
    return null;
  }

  getEntries(limit?: number): UndoEntry[] {
    if (limit) {
      return this.entries.slice(-limit);
    }
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  getSize(): number {
    return this.entries.length;
  }
}

export const undoManager = new UndoManager();

export const undoTool: ToolInstance = {
  name: "undo",
  description: "Revert the last recorded action or undo entry",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["last", "by_type", "list", "clear"],
        description: "Undo action to perform",
      },
      type: {
        type: "string",
        enum: ["turn", "tool", "edit"],
        description: "Undo entry type",
      },
      limit: { type: "number", description: "Limit for list action" },
    },
    required: ["action"],
  },
  riskLevel: "read",
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext) {
    const action = String(params["action"] ?? "");
    switch (action) {
      case "last": {
        const entry = undoManager.undo(1);
        return entry
          ? {
              success: true,
              output: `Undid: ${entry.description}`,
              metadata: entry as unknown as Record<string, unknown>,
            }
          : { success: false, output: "", error: "Nothing to undo" };
      }
      case "by_type": {
        const type = String(params["type"] ?? "");
        if (!type) {
          return { success: false, output: "", error: "type is required" };
        }
        const entry = undoManager.undoByType(type as UndoEntry["type"]);
        return entry
          ? {
              success: true,
              output: `Undid ${type}: ${entry.description}`,
              metadata: entry as unknown as Record<string, unknown>,
            }
          : {
              success: false,
              output: "",
              error: `No undo entry found for type: ${type}`,
            };
      }
      case "list": {
        const limit = Number(params["limit"] ?? 0) || undefined;
        const entries = undoManager.getEntries(limit);
        const output =
          entries.length === 0
            ? "No undo entries"
            : entries
                .map(
                  (entry) =>
                    `${entry.id}: ${entry.description} (${entry.type})`,
                )
                .join("\n");
        return { success: true, output, metadata: { count: entries.length } };
      }
      case "clear": {
        undoManager.clear();
        return { success: true, output: "Undo history cleared" };
      }
      default:
        return {
          success: false,
          output: "",
          error: `Unknown action: ${action}`,
        };
    }
  },
};
