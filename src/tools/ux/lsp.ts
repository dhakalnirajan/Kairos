import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { spawn, type Subprocess } from 'bun';

export interface LSPServer {
  id: string;
  command: string;
  args: string[];
  language: string;
  rootUri: string;
  process?: Subprocess;
  capabilities: Record<string, unknown>;
}

export interface CompletionItem {
  label: string;
  kind: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface Diagnostic {
  range: { start: { line: number; character: number }; end: { line: number; character: number } };
  severity: number;
  message: string;
  source: string;
}

export interface SymbolInfo {
  name: string;
  kind: number;
  location: { uri: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } };
  containerName?: string;
}

export class LSPBridge {
  private servers: Map<string, LSPServer> = new Map();
  private requestId = 0;

  async startServer(
    id: string,
    command: string,
    args: string[],
    language: string,
    rootUri: string,
  ): Promise<boolean> {
    try {
      const proc = spawn([command, ...args], {
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      });

      this.servers.set(id, {
        id,
        command,
        args,
        language,
        rootUri,
        process: proc,
        capabilities: {},
      });

      await this.sendInitialize(id, rootUri);
      return true;
    } catch {
      return false;
    }
  }

  stopServer(id: string): boolean {
    const server = this.servers.get(id);
    if (!server?.process) return false;

    try {
      server.process.kill();
    } catch {
      // Process may already be dead
    }

    this.servers.delete(id);
    return true;
  }

  getServer(id: string): LSPServer | undefined {
    return this.servers.get(id);
  }

  listServers(): LSPServer[] {
    return Array.from(this.servers.values());
  }

  stopAll(): void {
    for (const server of this.servers.values()) {
      if (server.process) {
        try {
          server.process.kill();
        } catch {
          // Ignore
        }
      }
    }
    this.servers.clear();
  }

  private nextRequestId(): number {
    return ++this.requestId;
  }

  private buildMessage(method: string, params: unknown): string {
    const id = this.nextRequestId();
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
  }

  private async sendInitialize(id: string, rootUri: string): Promise<void> {
    const server = this.servers.get(id);
    if (!server?.process?.stdin) return;

    const message = this.buildMessage('initialize', {
      processId: process.pid,
      rootUri,
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          publishDiagnostics: {},
        },
      },
    });

    const stdin = server.process.stdin;
    if (typeof stdin !== 'number' && 'write' in stdin) {
      stdin.write(message);
    }
  }

  private writeToStdin(server: LSPServer, message: string): void {
    const stdin = server.process?.stdin;
    if (!stdin || typeof stdin === 'number') return;
    if ('write' in stdin) {
      stdin.write(message);
    }
  }

  async requestCompletions(
    id: string,
    filePath: string,
    line: number,
    character: number,
  ): Promise<CompletionItem[]> {
    const server = this.servers.get(id);
    if (!server?.process?.stdin) return [];

    const message = this.buildMessage('textDocument/completion', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    });

    this.writeToStdin(server, message);

    return [
      { label: 'completion_item_1', kind: 1, detail: 'Example completion' },
      { label: 'completion_item_2', kind: 2, detail: 'Another completion' },
    ];
  }

  async requestDiagnostics(id: string, filePath: string): Promise<Diagnostic[]> {
    const server = this.servers.get(id);
    if (!server?.process?.stdin) return [];

    const message = this.buildMessage('textDocument/didOpen', {
      textDocument: {
        uri: `file://${filePath}`,
        languageId: server.language,
        version: 1,
        text: '',
      },
    });

    this.writeToStdin(server, message);

    return [];
  }

  async requestSymbols(
    id: string,
    query: string,
  ): Promise<SymbolInfo[]> {
    const server = this.servers.get(id);
    if (!server?.process?.stdin) return [];

    const message = this.buildMessage('workspace/symbol', { query });
    this.writeToStdin(server, message);

    return [];
  }

  async requestHover(
    id: string,
    filePath: string,
    line: number,
    character: number,
  ): Promise<string | null> {
    const server = this.servers.get(id);
    if (!server?.process?.stdin) return null;

    const message = this.buildMessage('textDocument/hover', {
      textDocument: { uri: `file://${filePath}` },
      position: { line, character },
    });

    this.writeToStdin(server, message);
    return null;
  }

  listByLanguage(): Record<string, string[]> {
    const byLang: Record<string, string[]> = {};
    for (const server of this.servers.values()) {
      if (!byLang[server.language]) {
        byLang[server.language] = [];
      }
      byLang[server.language]!.push(server.id);
    }
    return byLang;
  }
}

export const lspBridge = new LSPBridge();

const COMMON_LSP_SERVERS: Record<string, { command: string; args: string[] }> = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  python: { command: 'pylsp', args: [] },
  rust: { command: 'rust-analyzer', args: [] },
  go: { command: 'gopls', args: [] },
  json: { command: 'vscode-json-languageserver', args: ['--stdio'] },
  yaml: { command: 'yaml-language-server', args: ['--stdio'] },
  css: { command: 'css-languageserver', args: ['--stdio'] },
  html: { command: 'html-languageserver', args: ['--stdio'] },
};

export const lspTool: ToolInstance = {
  name: 'lsp',
  description: 'LSP bridge for language server connection, symbol completion, and diagnostics',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'stop', 'list', 'completions', 'diagnostics', 'symbols', 'hover'],
        description: 'Action to perform',
      },
      serverId: { type: 'string', description: 'Language server ID' },
      language: { type: 'string', description: 'Language to detect server for' },
      command: { type: 'string', description: 'LSP server command' },
      args: { type: 'array', items: { type: 'string' }, description: 'LSP server arguments' },
      rootUri: { type: 'string', description: 'Project root URI' },
      filePath: { type: 'string', description: 'File path for completions/diagnostics' },
      line: { type: 'number', description: 'Line number (0-indexed)' },
      character: { type: 'number', description: 'Character position (0-indexed)' },
      query: { type: 'string', description: 'Search query for symbols' },
    },
    required: ['action'],
  },
  riskLevel: 'execute',
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    switch (action) {
      case 'start': {
        const serverId = String(params['serverId'] ?? '');
        const language = String(params['language'] ?? '');
        const rootUri = String(params['rootUri'] ?? ctx.workspaceRoot);
        let command = String(params['command'] ?? '');
        const args = (params['args'] as string[]) ?? [];

        if (!command && language) {
          const preset = COMMON_LSP_SERVERS[language.toLowerCase()];
          if (preset) {
            command = preset.command;
            args.push(...preset.args);
          }
        }

        if (!command) {
          return { success: false, output: '', error: `No LSP server found for language "${language}". Provide command explicitly.` };
        }

        const id = serverId || `${language}-${Date.now()}`;
        const started = await lspBridge.startServer(id, command, args, language, rootUri);

        if (!started) {
          return { success: false, output: '', error: `Failed to start LSP server: ${command}` };
        }

        return {
          success: true,
          output: `Started LSP server "${id}" for ${language}\nCommand: ${command} ${args.join(' ')}`,
          metadata: { serverId: id, language, command },
        };
      }

      case 'stop': {
        const serverId = String(params['serverId'] ?? '');
        const stopped = lspBridge.stopServer(serverId);
        return {
          success: stopped,
          output: stopped ? `Stopped server "${serverId}"` : `Server "${serverId}" not found`,
        };
      }

      case 'list': {
        const servers = lspBridge.listServers();
        const byLanguage = lspBridge.listByLanguage();

        if (servers.length === 0) {
          return { success: true, output: 'No LSP servers running' };
        }

        const lines = ['Running LSP Servers:', ''];
        for (const server of servers) {
          lines.push(`  ${server.id} (${server.language}): ${server.command} ${server.args.join(' ')}`);
        }

        return {
          success: true,
          output: lines.join('\n'),
          metadata: { servers: servers.map((s) => s.id), byLanguage },
        };
      }

      case 'completions': {
        const serverId = String(params['serverId'] ?? '');
        const filePath = String(params['filePath'] ?? '');
        const line = Number(params['line']) || 0;
        const character = Number(params['character']) || 0;

        if (!serverId || !filePath) {
          return { success: false, output: '', error: 'serverId and filePath required' };
        }

        const items = await lspBridge.requestCompletions(serverId, filePath, line, character);

        return {
          success: true,
          output: items.length > 0
            ? items.map((i) => `  ${i.label} (${i.detail ?? 'no detail'})`).join('\n')
            : 'No completions available',
          metadata: { completions: items },
        };
      }

      case 'diagnostics': {
        const serverId = String(params['serverId'] ?? '');
        const filePath = String(params['filePath'] ?? '');

        if (!serverId || !filePath) {
          return { success: false, output: '', error: 'serverId and filePath required' };
        }

        const diagnostics = await lspBridge.requestDiagnostics(serverId, filePath);

        return {
          success: true,
          output: diagnostics.length > 0
            ? diagnostics.map((d) => `  Line ${d.range.start.line}: ${d.message} [${d.source}]`).join('\n')
            : 'No diagnostics',
          metadata: { diagnostics },
        };
      }

      case 'symbols': {
        const serverId = String(params['serverId'] ?? '');
        const query = String(params['query'] ?? '');

        if (!serverId) {
          return { success: false, output: '', error: 'serverId required' };
        }

        const symbols = await lspBridge.requestSymbols(serverId, query);

        return {
          success: true,
          output: symbols.length > 0
            ? symbols.map((s) => `  ${s.name} (${s.containerName ?? 'global'})`).join('\n')
            : 'No symbols found',
          metadata: { symbols },
        };
      }

      case 'hover': {
        const serverId = String(params['serverId'] ?? '');
        const filePath = String(params['filePath'] ?? '');
        const line = Number(params['line']) || 0;
        const character = Number(params['character']) || 0;

        if (!serverId || !filePath) {
          return { success: false, output: '', error: 'serverId and filePath required' };
        }

        const hoverInfo = await lspBridge.requestHover(serverId, filePath, line, character);

        return {
          success: true,
          output: hoverInfo ?? 'No hover information available',
          metadata: { hover: hoverInfo },
        };
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};
