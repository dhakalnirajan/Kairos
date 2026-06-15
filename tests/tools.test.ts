import { describe, test, expect } from 'bun:test';
import { ToolRegistry } from '../src/tools/registry.ts';
import { readFileTool } from '../src/tools/builtin/read_file.ts';
import { writeFileTool } from '../src/tools/builtin/write_file.ts';
import { bashTool } from '../src/tools/builtin/bash.ts';
import { memoryOpsTool } from '../src/tools/builtin/memory_ops.ts';
import { registerAllBuiltinTools } from '../src/tools/builtin/index.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';

const testDir = join(process.cwd(), '_test_workspace');
const config = {
  safety: {
    enabled: false,
    allowedRiskLevels: ['read', 'write', 'execute'],
    blockedCommands: [],
    blockedPaths: [],
    autoApprove: true,
    requireConfirmationFor: [],
  },
} as unknown as KairosConfigOutput;

describe('ToolRegistry', () => {
  test('register and get tool', () => {
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    expect(registry.get('read_file')).toBeDefined();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  test('getManifests excludes execute method', () => {
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    const manifests = registry.getManifests();
    expect(manifests.length).toBe(1);
    expect(manifests[0]?.name).toBe('read_file');
    expect(typeof (manifests[0] as Record<string, unknown>)['execute']).toBe('undefined');
  });

  test('toOpenAITools generates correct format', () => {
    const registry = new ToolRegistry();
    registry.register(readFileTool);
    const tools = registry.toOpenAITools();
    expect(tools.length).toBe(1);
    expect(tools[0]?.type).toBe('function');
    expect(tools[0]?.function.name).toBe('read_file');
  });

  test('registerAllBuiltinTools registers all tools', async () => {
    const registry = new ToolRegistry();
    await registerAllBuiltinTools(registry);
    expect(registry.getAll().length).toBeGreaterThanOrEqual(11);
    expect(registry.get("workflow")).toBeDefined();
    expect(registry.get("alias")).toBeDefined();
    expect(registry.get("knowledge")).toBeDefined();
    expect(registry.get("metrics")).toBeDefined();
    expect(registry.get("undo")).toBeDefined();
  });
});

describe('read_file tool', () => {
  test('reads existing file', async () => {
    const result = await readFileTool.execute(
      { path: 'package.json' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('kairos-code');
  });

  test('returns error for missing file', async () => {
    const result = await readFileTool.execute(
      { path: 'nonexistent.txt' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('accepts "file" param alias', async () => {
    const result = await readFileTool.execute(
      { file: 'package.json' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(true);
  });

  test('accepts "param" param alias', async () => {
    const result = await readFileTool.execute(
      { param: 'package.json' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(true);
  });
});

describe('write_file tool', () => {
  test('creates file and directories', async () => {
    const filePath = join(testDir, 'sub', 'test.txt');
    const result = await writeFileTool.execute(
      { path: filePath, content: 'hello world' },
      { workspaceRoot: testDir, sessionId: 'test' },
    );
    expect(result.success).toBe(true);
    expect(existsSync(filePath)).toBe(true);

    rmSync(testDir, { recursive: true, force: true });
  });
});

describe('bash tool', () => {
  test('executes command', async () => {
    const result = await bashTool.execute(
      { command: 'echo hello' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello');
  });

  test('reports non-zero exit code', async () => {
    const result = await bashTool.execute(
      { command: 'exit 1' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(false);
  });
});

describe('memory_ops tool', () => {
  test('store and search facts', async () => {
    const storeResult = await memoryOpsTool.execute(
      { operation: 'store', topic: 'test', query: 'TypeScript is strongly typed' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(storeResult.success).toBe(true);

    const searchResult = await memoryOpsTool.execute(
      { operation: 'search', query: 'TypeScript' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(searchResult.success).toBe(true);
    expect(searchResult.output).toContain('rowid');
  });

  test('get fact by id', async () => {
    const store = await memoryOpsTool.execute(
      { operation: 'store', topic: 'test', query: 'Bun is fast' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(store.success).toBe(true);

    const idMatch = store.metadata?.id;
    const getResult = await memoryOpsTool.execute(
      { operation: 'get', id: idMatch },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(getResult.success).toBe(true);
    expect(getResult.output).toContain('Bun is fast');
  });
});
