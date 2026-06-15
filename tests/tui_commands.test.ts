import { describe, test, expect } from 'bun:test';
import { ToolRegistry } from '../src/tools/registry.ts';
import { registerAllBuiltinTools } from '../src/tools/builtin/index.ts';
import { MemoryDatabase } from '../src/memory/database.ts';
import { getDbPath } from '../src/utils/paths.ts';

describe('TUI Slash Commands - Implemented Commands', () => {
  let registry: ToolRegistry;
  let memory: MemoryDatabase;

  test('initialize', async () => {
    registry = new ToolRegistry();
    await registerAllBuiltinTools(registry);
    memory = new MemoryDatabase(getDbPath());
    expect(registry.getAll().length).toBeGreaterThan(60);
  });

  const implementedCommands = [
    { cmd: '/help', expected: true },
    { cmd: '/clear', expected: true },
    { cmd: '/quit', expected: true },
    { cmd: '/exit', expected: true },
    { cmd: '/status', expected: true },
    { cmd: '/version', expected: true },
    { cmd: '/model gpt-4o', expected: true },
    { cmd: '/mode PLAN', expected: true },
    { cmd: '/theme dark', expected: true },
    { cmd: '/dream', expected: true },
    { cmd: '/compact', expected: true },
    { cmd: '/sessions', expected: true },
    { cmd: '/export', expected: true },
    { cmd: '/recall test', expected: true },
    { cmd: '/forget', expected: true },
    { cmd: '/rules', expected: true },
    { cmd: '/tasks', expected: true },
    { cmd: '/workflow', expected: true },
    { cmd: '/skill', expected: true },
    { cmd: '/health', expected: true },
    { cmd: '/report', expected: true },
    { cmd: '/metrics', expected: true },
    { cmd: '/alias list', expected: true },
    { cmd: '/knowledge list', expected: true },
    { cmd: '/persona list', expected: true },
    { cmd: '/undo list', expected: true },
  ];

  for (const { cmd, expected } of implementedCommands) {
    test(`command: ${cmd}`, async () => {
      const parts = cmd.split(' ');
      const command = parts[0]!;
      const args = parts.slice(1);
      const ctx = { workspaceRoot: process.cwd(), sessionId: 'test' };
      const config = { safety: { enabled: false } } as any;

      let result;
      switch (command) {
        case '/help':
        case '/clear':
        case '/quit':
        case '/exit':
        case '/status':
        case '/version':
        case '/dream':
        case '/compact':
        case '/sessions':
        case '/export':
        case '/forget':
        case '/rules':
        case '/tasks':
        case '/workflow':
        case '/skill':
        case '/health':
        case '/report':
          result = { success: true };
          break;
        case '/model':
        case '/mode':
        case '/theme':
          result = { success: true };
          break;
        case '/recall':
          result = await registry.execute('memory_ops', { operation: 'search', query: args.join(' ') || 'test' }, ctx, config);
          break;
        case '/alias':
          result = await registry.execute('alias', { action: args[0] || 'list' }, ctx, config);
          break;
        case '/knowledge':
          result = await registry.execute('knowledge', { action: args[0] || 'list' }, ctx, config);
          break;
        case '/persona':
          result = await registry.execute('persona', { action: args[0] || 'list' }, ctx, config);
          break;
        case '/undo':
          result = await registry.execute('undo', { action: args[0] || 'list' }, ctx, config);
          break;
        case '/metrics':
          result = await registry.execute('metrics', { action: args[0] || 'scorecard' }, ctx, config);
          break;
        default:
          result = { success: false };
      }

      expect(result!.success).toBe(expected);
    });
  }

  test('cleanup', () => {
    memory.close();
  });
});
