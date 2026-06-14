import { describe, test, expect } from 'bun:test';
import { SwarmCoordinator, type SwarmTask, type SwarmConfig } from '../src/agent/swarm.ts';
import { createLLMClient } from '../src/llm/client.ts';
import { ToolRegistry } from '../src/tools/registry.ts';
import { MemoryDatabase } from '../src/memory/database.ts';
import { registerAllBuiltinTools } from '../src/tools/builtin/index.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';
import { getDbPath } from '../src/utils/paths.ts';

function createTestConfig(): KairosConfigOutput {
  return {
    version: '0.1.0',
    llm: { provider: 'llamacpp', model: 'test', baseUrl: 'http://localhost:8080', maxTokens: 1024, temperature: 0.7 },
    tools: { enabled: [], disabled: [], custom: [], confirmBeforeExecute: false, maxConcurrent: 4 },
    safety: { enabled: false, allowedRiskLevels: ['read', 'write', 'execute', 'network'], blockedCommands: [], blockedPaths: [], autoApprove: true, requireConfirmationFor: [] },
    tui: { theme: 'default', showTimestamps: true, showTokenCount: true, showCost: false, compactMode: false, useColors: true },
    memory: { enabled: true, persistToDisk: false, maxSessionSize: 1024, compressThreshold: 512, ttlDays: 30 },
    daemon: { enabled: false, port: 7777, maxWorkers: 4, taskTimeout: 300000, heartbeatInterval: 5000, pidFile: '', logFile: '' },
    hooks: { enabled: false, preTool: [], postTool: [], preTurn: [], postTurn: [], onError: [] },
    extensions: { enabled: false, autoDiscover: false, searchPaths: [], loaded: [], disabled: [] },
    paths: { home: '', config: '', data: '', cache: '', logs: '', sessions: '', memory: '', extensions: '' },
  };
}

describe('SwarmCoordinator', () => {
  test('initializes with correct defaults', () => {
    const config = createTestConfig();
    const llm = createLLMClient(config.llm);
    const tools = new ToolRegistry();
    const memory = new MemoryDatabase(':memory:');
    const swarm = new SwarmCoordinator(llm, tools, memory, config);

    const progress = swarm.getProgress();
    expect(progress.total).toBe(0);
    expect(progress.completed).toBe(0);
    expect(progress.failed).toBe(0);
    expect(progress.running).toBe(0);
    memory.close();
  });

  test('custom swarm config overrides defaults', () => {
    const config = createTestConfig();
    const llm = createLLMClient(config.llm);
    const tools = new ToolRegistry();
    const memory = new MemoryDatabase(':memory:');
    const swarm = new SwarmCoordinator(llm, tools, memory, config, {
      maxWorkers: 5,
      maxTokensPerWorker: 8192,
    });

    expect(swarm).toBeDefined();
    memory.close();
  });

  test('abort stops execution', () => {
    const config = createTestConfig();
    const llm = createLLMClient(config.llm);
    const tools = new ToolRegistry();
    const memory = new MemoryDatabase(':memory:');
    const swarm = new SwarmCoordinator(llm, tools, memory, config);

    swarm.abort();
    const progress = swarm.getProgress();
    expect(progress.total).toBe(0);
    memory.close();
  });

  test('getTasks returns empty initially', () => {
    const config = createTestConfig();
    const llm = createLLMClient(config.llm);
    const tools = new ToolRegistry();
    const memory = new MemoryDatabase(':memory:');
    const swarm = new SwarmCoordinator(llm, tools, memory, config);

    expect(swarm.getTasks()).toEqual([]);
    memory.close();
  });
});
