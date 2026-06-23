import { resolveFilePath } from "../../../utils/path_security.ts";
import type {
  ToolInstance,
  ToolContext,
  ToolResult,
} from "../../../types/tools.ts";

export const editFileTool: ToolInstance = {
  name: "edit_file",
  description: "Replace exact text in a file. oldString must match exactly.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to edit" },
      oldString: {
        type: "string",
        description: "Exact text to find and replace",
      },
      newString: { type: "string", description: "Replacement text" },
    },
    required: ["path", "oldString", "newString"],
  },
  riskLevel: "write",
  isIdempotent: false,

  async execute(
    params: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    try {
      const filePath = resolveFilePath(
        String(params["path"] ?? ""),
        ctx.workspaceRoot,
      );
      const file = Bun.file(filePath);

      if (!(await file.exists())) {
        return {
          success: false,
          output: "",
          error: `File not found: ${filePath}`,
        };
      }

      const content = await file.text();
      const oldString = String(params["oldString"] ?? "");
      const newString = String(params["newString"] ?? "");

      if (!content.includes(oldString)) {
        return {
          success: false,
          output: "",
          error: "oldString not found in file content",
        };
      }

      const count = content.split(oldString).length - 1;
      if (count > 1) {
        return {
          success: false,
          output: "",
          error: `Found ${count} matches for oldString. Provide more context to make it unique.`,
        };
      }

      const updated = content.replace(oldString, newString);
      const bytes = await Bun.write(filePath, updated);

      return {
        success: true,
        output: `Edited ${filePath} (${bytes} bytes)`,
        metadata: { path: filePath, bytes },
      };
    } catch (e) {
      return { success: false, output: "", error: `Failed to edit file: ${e}` };
    }
  },
};
