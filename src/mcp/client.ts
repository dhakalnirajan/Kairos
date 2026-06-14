import { join } from 'path';
import { getKairosDir } from '../utils/paths.ts';
import type { ToolRegistry } from '../tools/registry.ts';

export type Transport = 'stdio' | 'sse';

export interface MCPServerConfig {
  name: string;
  transport: Transport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPServerState {
  config: MCPServerConfig;
  connected: boolean;
  process?: ReturnType<typeof Bun.spawn>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export class MCPClient {
  private servers: Map<string, MCPServerState> = new Map();
  private tools: Map<string, MCPTool> = new Map();

  async addServer(config: MCPServerConfig): Promise<MCPServerState> {
    const state: MCPServerState = {
      config,
      connected: false,
    };

    if (config.transport === 'stdio' && config.command) {
      try {
        const proc = Bun.spawn([config.command, ...(config.args ?? [])], {
          stdout: 'pipe',
          stderr: 'pipe',
          env: config.env,
        });
        state.process = proc;
        state.connected = true;

        const stdout = await new Response(proc.stdout).text();
        try {
          const tools = JSON.parse(stdout) as MCPTool[];
          for (const tool of tools) {
            this.tools.set(`${config.name}:${tool.name}`, tool);
          }
        } catch {}
      } catch {
        state.connected = false;
      }
    }

    this.servers.set(config.name, state);
    return state;
  }

  getServers(): MCPServerState[] {
    return Array.from(this.servers.values());
  }

  getServer(name: string): MCPServerState | undefined {
    return this.servers.get(name);
  }

  removeServer(name: string): boolean {
    const server = this.servers.get(name);
    if (!server) return false;

    if (server.process) {
      server.process.kill();
    }

    this.servers.delete(name);
    return true;
  }

  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  registerTools(registry: ToolRegistry): void {
    for (const tool of this.tools.values()) {
      registry.register({
        name: `mcp:${tool.name}`,
        description: tool.description,
        parameters: tool.parameters as any,
        riskLevel: 'read',
        isIdempotent: true,
        execute: async (params) => {
          return { success: true, output: JSON.stringify(params) };
        },
      });
    }
  }

  async callTool(serverName: string, toolName: string, params: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverName);
    if (!server?.connected) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    const tool = this.tools.get(`${serverName}:${toolName}`);
    if (!tool) {
      throw new Error(`MCP tool not found: ${toolName}`);
    }

    return { tool: tool.name, params };
  }

  async shutdown(): Promise<void> {
    for (const server of this.servers.values()) {
      if (server.process) {
        server.process.kill();
      }
    }
    this.servers.clear();
    this.tools.clear();
  }
}
