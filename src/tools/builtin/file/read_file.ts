import { resolveFilePath } from "../../../utils/path_security.ts";
import type {
  ToolInstance,
  ToolContext,
  ToolResult,
} from "../../../types/tools.ts";

export const readFileTool: ToolInstance = {
  name: "read_file",
  description: "Read the contents of a file from the filesystem",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Absolute or relative file path" },
      offset: {
        type: "number",
        description: "Line number to start from (1-indexed)",
      },
      limit: { type: "number", description: "Maximum number of lines to read" },
    },
    required: ["path"],
  },
  riskLevel: "read",
  isIdempotent: true,

  async execute(
    params: Record<string, unknown>,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    try {
      const filePath = resolveFilePath(
        String(params["path"] ?? params["file"] ?? params["param"] ?? ""),
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
      const lines = content.split("\n");
      const offset = Math.max(0, (Number(params["offset"]) || 1) - 1);
      const limit = Number(params["limit"]) || lines.length;
      const sliced = lines.slice(offset, offset + limit).join("\n");

      return {
        success: true,
        output: sliced,
        metadata: {
          path: filePath,
          totalLines: lines.length,
          returnedLines: Math.min(limit, lines.length - offset),
        },
      };
    } catch (e) {
      return { success: false, output: "", error: `Failed to read file: ${e}` };
    }
  },
};
