import { describe, test, expect } from 'bun:test';
import { MCPClient, type MCPServerConfig } from '../src/mcp/client.ts';
import { ToolRegistry } from '../src/tools/registry.ts';

describe('MCPClient', () => {
  test('addServer with stdio transport', async () => {
    const client = new MCPClient();
    const server = await client.addServer({
      name: 'test-stdio',
      transport: 'stdio',
      command: 'echo',
      args: ['{"jsonrpc":"2.0","id":1,"result":{"capabilities":{"tools":{}}}}'],
    });
    expect(server.config.name).toBe('test-stdio');
    expect(server.config.transport).toBe('stdio');
  });

  test('addServer with invalid command fails gracefully', async () => {
    const client = new MCPClient();
    const server = await client.addServer({
      name: 'bad-server',
      transport: 'stdio',
      command: 'nonexistent-command-xyz',
    });
    expect(server.connected).toBe(false);
  });

  test('getServers returns all added servers', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 's1', transport: 'sse', url: 'http://localhost:99999' });
    await client.addServer({ name: 's2', transport: 'sse', url: 'http://localhost:99998' });
    const servers = client.getServers();
    expect(servers.length).toBe(2);
    expect(servers.map((s) => s.config.name)).toContain('s1');
    expect(servers.map((s) => s.config.name)).toContain('s2');
  });

  test('removeServer removes server', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 'to-remove', transport: 'sse', url: 'http://localhost:99999' });
    expect(client.getServers().length).toBe(1);
    await client.removeServer('to-remove');
    expect(client.getServers().length).toBe(0);
  });

  test('getTools returns empty for disconnected servers', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 'disconnected', transport: 'sse', url: 'http://localhost:99999' });
    const tools = client.getTools();
    expect(tools.length).toBe(0);
  });

  test('registerTools adds MCP tools to registry', async () => {
    const client = new MCPClient();
    const registry = new ToolRegistry();
    client.registerTools(registry);
    expect(registry.getAll().length).toBe(0);
  });

  test('callTool throws for disconnected server', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 'disconnected', transport: 'sse', url: 'http://localhost:99999' });
    try {
      await client.callTool('disconnected', 'test', {});
      expect(true).toBe(false);
    } catch (e) {
      expect(String(e)).toContain('not connected');
    }
  });

  test('callTool throws for unknown server', async () => {
    const client = new MCPClient();
    try {
      await client.callTool('unknown', 'test', {});
      expect(true).toBe(false);
    } catch (e) {
      expect(String(e)).toContain('not connected');
    }
  });

  test('shutdown cleans up all servers', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 's1', transport: 'sse', url: 'http://localhost:99999' });
    await client.addServer({ name: 's2', transport: 'sse', url: 'http://localhost:99998' });
    await client.shutdown();
    expect(client.getServers().length).toBe(0);
  });
});
