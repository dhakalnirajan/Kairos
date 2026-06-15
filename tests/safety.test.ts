import { describe, test, expect } from 'bun:test';
import { SafetyPipeline } from '../src/security/pipeline.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';
import { join } from 'path';

const defaultConfig: KairosConfigOutput = {
  version: '0.1.1',
  llm: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.anthropic.com/v1',
    maxTokens: 8192,
    temperature: 0.7,
    fallbackEnabled: true,
    autoDiscoverLocal: true,
  },
  tools: {
    enabled: ['read', 'write', 'edit', 'bash', 'glob', 'grep'],
    disabled: [],
    custom: [],
    confirmBeforeExecute: true,
    maxConcurrent: 4,
  },
  safety: {
    enabled: true,
    allowedRiskLevels: ['read', 'write', 'execute'],
    blockedCommands: ['rm -rf /', 'format', 'del /s /q'],
    blockedPaths: ['/etc', '/System', '/Windows/System32'],
    autoApprove: false,
    requireConfirmationFor: ['bash', 'write', 'edit'],
  },
  tui: {
    theme: 'default',
    showTimestamps: true,
    showTokenCount: true,
    showCost: false,
    compactMode: false,
    useColors: true,
  },
  memory: {
    enabled: true,
    persistToDisk: true,
    maxSessionSize: 1048576,
    compressThreshold: 524288,
    ttlDays: 30,
  },
  daemon: {
    enabled: false,
    port: 7777,
    maxWorkers: 4,
    taskTimeout: 300000,
    heartbeatInterval: 5000,
    pidFile: '',
    logFile: '',
  },
  hooks: {
    enabled: false,
    preTool: [],
    postTool: [],
    preTurn: [],
    postTurn: [],
    onError: [],
  },
  extensions: {
    enabled: true,
    autoDiscover: true,
    searchPaths: [],
    loaded: [],
    disabled: [],
  },
  paths: {
    home: process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp',
    config: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos'),
    data: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'data'),
    cache: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'cache'),
    logs: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'logs'),
    sessions: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'sessions'),
    memory: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'memory'),
    extensions: join(process.env['USERPROFILE'] ?? process.env['HOME'] ?? '/tmp', '.kairos', 'extensions'),
  },
};

describe('SafetyPipeline', () => {
  const pipeline = new SafetyPipeline();
  const workspaceRoot = process.cwd();

  test('allows read operations', async () => {
    const verdict = await pipeline.evaluate(
      'read_file',
      { path: 'src/main.ts' },
      'read',
      defaultConfig,
      workspaceRoot,
    );
    expect(verdict.allowed).toBe(true);
  });

  test('blocks destructive commands', async () => {
    const verdict = await pipeline.evaluate(
      'bash',
      { command: 'rm -rf /' },
      'execute',
      defaultConfig,
      workspaceRoot,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.layer).toBe('harm-detection');
  });

  test('blocks private IPs', async () => {
    const verdict = await pipeline.evaluate(
      'http_fetch',
      { url: 'http://192.168.1.1' },
      'network',
      defaultConfig,
      workspaceRoot,
    );
    expect(verdict.allowed).toBe(false);
  });

  test('requires confirmation for bash', async () => {
    const verdict = await pipeline.evaluate(
      'bash',
      { command: 'ls' },
      'execute',
      defaultConfig,
      workspaceRoot,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.layer).toBe('hitl');
  });

  test('audit logging works', async () => {
    await pipeline.evaluateWithAudit(
      'read_file',
      { path: 'test.ts' },
      'read',
      defaultConfig,
      workspaceRoot,
    );
    const log = pipeline.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
  });

  test('scrubs secrets from audit log', async () => {
    await pipeline.evaluateWithAudit(
      'bash',
      { command: 'api_key=secret12345678' },
      'execute',
      defaultConfig,
      workspaceRoot,
    );
    const log = pipeline.getAuditLog();
    const lastEntry = log[log.length - 1];
    expect(lastEntry?.parameters).not.toContain('secret12345678');
  });
});
