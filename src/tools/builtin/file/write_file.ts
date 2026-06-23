import { resolveFilePath } from "../../../utils/path_security.ts";
import type {
  ToolInstance,
  ToolContext,
  ToolResult,
} from "../../../types/tools.ts";

export const writeFileTool: ToolInstance = {
  name: "write_file",
  description: "Write content to a file, creating parent directories if needed",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write to" },
      content: { type: "string", description: "Content to write" },
    },
    required: ["path", "content"],
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
      const bytes = await Bun.write(filePath, String(params["content"] ?? ""));
      return {
        success: true,
        output: `Wrote ${bytes} bytes to ${filePath}`,
        metadata: { path: filePath, bytes },
      };
    } catch (e) {
      return {
        success: false,
        output: "",
        error: `Failed to write file: ${e}`,
      };
    }
  },
};
