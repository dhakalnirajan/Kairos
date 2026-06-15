export interface Alias {
  name: string;
  expansion: string;
  description?: string;
}

import type { ToolContext, ToolInstance } from "../types/tools.ts";

export class AliasManager {
  private aliases: Map<string, Alias> = new Map();

  addAlias(name: string, expansion: string, description?: string): void {
    this.aliases.set(name, { name, expansion, description });
  }

  removeAlias(name: string): boolean {
    return this.aliases.delete(name);
  }

  getAlias(name: string): Alias | undefined {
    return this.aliases.get(name);
  }

  expand(text: string): string {
    let expanded = text;
    for (const [name, alias] of this.aliases) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      expanded = expanded.replace(regex, alias.expansion);
    }
    return expanded;
  }

  listAliases(): Alias[] {
    return Array.from(this.aliases.values());
  }

  hasAlias(name: string): boolean {
    return this.aliases.has(name);
  }

  clear(): void {
    this.aliases.clear();
  }
}

export const aliasManager = new AliasManager();

export const aliasTool: ToolInstance = {
  name: "alias",
  description: "Manage user-defined command aliases and expansions",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "add", "remove", "expand", "clear"],
        description: "Alias action to perform",
      },
      name: { type: "string", description: "Alias name" },
      expansion: { type: "string", description: "Alias expansion text" },
      text: { type: "string", description: "Text to expand using aliases" },
    },
    required: ["action"],
  },
  riskLevel: "read",
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext) {
    const action = String(params["action"] ?? "");

    switch (action) {
      case "list": {
        const aliases = aliasManager.listAliases();
        const output =
          aliases.length === 0
            ? "No aliases defined"
            : aliases
                .map((alias) => `${alias.name}: ${alias.expansion}`)
                .join("\n");
        return { success: true, output, metadata: { count: aliases.length } };
      }
      case "add": {
        const name = String(params["name"] ?? "");
        const expansion = String(params["expansion"] ?? "");
        if (!name || !expansion) {
          return {
            success: false,
            output: "",
            error: "name and expansion are required",
          };
        }
        aliasManager.addAlias(name, expansion);
        return {
          success: true,
          output: `Alias added: ${name} = ${expansion}`,
          metadata: { name },
        };
      }
      case "remove": {
        const name = String(params["name"] ?? "");
        if (!name) {
          return { success: false, output: "", error: "name is required" };
        }
        const removed = aliasManager.removeAlias(name);
        return removed
          ? { success: true, output: `Alias removed: ${name}` }
          : { success: false, output: "", error: `Alias not found: ${name}` };
      }
      case "expand": {
        const text = String(params["text"] ?? "");
        if (!text) {
          return { success: false, output: "", error: "text is required" };
        }
        const expanded = aliasManager.expand(text);
        return {
          success: true,
          output: expanded,
          metadata: { text, expanded },
        };
      }
      case "clear": {
        aliasManager.clear();
        return { success: true, output: "All aliases cleared" };
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
