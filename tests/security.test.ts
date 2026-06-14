import { describe, test, expect } from 'bun:test';
import { SafetyPipeline } from '../src/security/pipeline.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';

const baseConfig = {
  safety: {
    enabled: true,
    allowedRiskLevels: ['read', 'write', 'execute', 'network'] as const,
    blockedCommands: ['rm -rf /', 'format', 'del /s /q'],
    blockedPaths: ['/etc', '/System', '/Windows/System32'],
    autoApprove: false,
    requireConfirmationFor: [],
  },
} as unknown as KairosConfigOutput;

describe('SafetyPipeline', () => {
  test('allows read operations', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('read_file', { path: 'test.txt' }, 'read', baseConfig, process.cwd());
    expect(result.allowed).toBe(true);
  });

  test('blocks when safety disabled', async () => {
    const config = { safety: { ...baseConfig.safety, enabled: false } } as unknown as KairosConfigOutput;
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('bash', { command: 'rm -rf /' }, 'execute', config, '/workspace');
    expect(result.allowed).toBe(true);
  });

  test('blocks destructive commands', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('bash', { command: 'rm -rf /' }, 'execute', baseConfig, '/workspace');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('harm-detection');
  });

  test('blocks path traversal', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('read_file', { path: '../../../etc/passwd' }, 'read', baseConfig, '/workspace');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('blueprint-policy');
  });

  test('blocks private IPs for network tools', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('http_fetch', { url: 'http://169.254.169.254/metadata' }, 'network', baseConfig, '/workspace');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('blueprint-policy');
  });

  test('allows public URLs', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('http_fetch', { url: 'https://example.com' }, 'network', baseConfig, '/workspace');
    expect(result.allowed).toBe(true);
  });

  test('blocks disallowed risk levels', async () => {
    const config = {
      safety: { ...baseConfig.safety, allowedRiskLevels: ['read'] },
    } as unknown as KairosConfigOutput;
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('write_file', { path: 'test.txt' }, 'write', config, '/workspace');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('risk-classification');
  });

  test('handles null params gracefully', async () => {
    const pipeline = new SafetyPipeline();
    const result = await pipeline.evaluate('read_file', {}, 'read', baseConfig, '/workspace');
    expect(result.allowed).toBe(true);
  });
});
