import { describe, test, expect } from 'bun:test';
import { ExtensionLoader, type Extension, type ExtensionManifest } from '../src/extensions/loader.ts';
import { ToolRegistry } from '../src/tools/registry.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';

function createTestConfig(searchPaths: string[] = [], disabled: string[] = []): KairosConfigOutput {
  return {
    version: '0.1.1',
    llm: { provider: 'llamacpp', model: 'test', baseUrl: 'http://localhost:8080', maxTokens: 1024, temperature: 0.7 },
    tools: { enabled: [], disabled: [], custom: [], confirmBeforeExecute: false, maxConcurrent: 4 },
    safety: { enabled: false, allowedRiskLevels: ['read', 'write', 'execute', 'network'], blockedCommands: [], blockedPaths: [], autoApprove: true, requireConfirmationFor: [] },
    tui: { theme: 'default', showTimestamps: true, showTokenCount: true, showCost: false, compactMode: false, useColors: true },
    memory: { enabled: true, persistToDisk: false, maxSessionSize: 1024, compressThreshold: 512, ttlDays: 30 },
    daemon: { enabled: false, port: 7777, maxWorkers: 4, taskTimeout: 300000, heartbeatInterval: 5000, pidFile: '', logFile: '' },
    hooks: { enabled: false, preTool: [], postTool: [], preTurn: [], postTurn: [], onError: [] },
    extensions: { enabled: true, autoDiscover: true, searchPaths, loaded: [], disabled },
    paths: { home: '', config: '', data: '', cache: '', logs: '', sessions: '', memory: '', extensions: '' },
  };
}

describe('ExtensionLoader', () => {
  test('discovers extensions from search path', async () => {
    const testDir = join(process.cwd(), '_test_ext_int');
    const extDir = join(testDir, 'myext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({
      name: 'test-ext',
      version: '1.0.0',
      description: 'Test extension',
      skills: ['test-skill'],
      tools: [{ name: 'greet', description: 'Say hello', parameters: { type: 'object', properties: {} }, riskLevel: 'read', handler: 'greet.ts' }],
    }));

    const config = createTestConfig([testDir]);
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(1);
    expect(extensions[0]?.manifest.name).toBe('test-ext');
    expect(extensions[0]?.manifest.version).toBe('1.0.0');
    expect(extensions[0]?.manifest.tools?.length).toBe(1);
    rmSync(testDir, { recursive: true, force: true });
  });

  test('skips disabled extensions', async () => {
    const testDir = join(process.cwd(), '_test_ext_disabled');
    const extDir = join(testDir, 'disabled-ext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({ name: 'disabled-ext', version: '1.0.0' }));

    const config = createTestConfig([testDir], ['disabled-ext']);
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(1);
    expect(extensions[0]?.enabled).toBe(false);
    rmSync(testDir, { recursive: true, force: true });
  });

  test('returns empty when extensions disabled', async () => {
    const config = createTestConfig();
    config.extensions.enabled = false;
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(0);
  });

  test('returns empty for nonexistent search path', async () => {
    const config = createTestConfig(['/nonexistent/path']);
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(0);
  });

  test('getExtension returns specific extension', async () => {
    const testDir = join(process.cwd(), '_test_ext_get');
    const extDir = join(testDir, 'myext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({ name: 'get-test', version: '1.0.0' }));

    const config = createTestConfig([testDir]);
    const loader = new ExtensionLoader(config);
    await loader.discover();
    const ext = loader.getExtension('get-test');
    expect(ext).toBeDefined();
    expect(ext?.manifest.name).toBe('get-test');
    rmSync(testDir, { recursive: true, force: true });
  });

  test('getAllExtensions returns all discovered', async () => {
    const testDir = join(process.cwd(), '_test_ext_all');
    mkdirSync(join(testDir, 'ext1'), { recursive: true });
    mkdirSync(join(testDir, 'ext2'), { recursive: true });
    writeFileSync(join(testDir, 'ext1', 'manifest.json'), JSON.stringify({ name: 'ext1', version: '1.0.0' }));
    writeFileSync(join(testDir, 'ext2', 'manifest.json'), JSON.stringify({ name: 'ext2', version: '1.0.0' }));

    const config = createTestConfig([testDir]);
    const loader = new ExtensionLoader(config);
    await loader.discover();
    const all = loader.getAllExtensions();
    expect(all.length).toBe(2);
    rmSync(testDir, { recursive: true, force: true });
  });

  test('loadTools registers extension tools', async () => {
    const testDir = join(process.cwd(), '_test_ext_tools');
    const extDir = join(testDir, 'tool-ext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({
      name: 'tool-ext',
      version: '1.0.0',
      tools: [{ name: 'greet', description: 'Say hello', parameters: { type: 'object', properties: {} }, riskLevel: 'read', handler: 'greet.ts' }],
    }));
    writeFileSync(join(extDir, 'greet.ts'), 'console.log(JSON.stringify({ output: "hello" }));');

    const config = createTestConfig([testDir]);
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    const registry = new ToolRegistry();

    if (extensions[0]) {
      await loader.loadTools(extensions[0], registry);
      expect(registry.getAll().length).toBe(1);
      expect(registry.getAll()[0]?.name).toBe('ext_tool-ext_greet');
    }

    rmSync(testDir, { recursive: true, force: true });
  });
});
