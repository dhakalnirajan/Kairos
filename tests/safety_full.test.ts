import { describe, test, expect } from 'bun:test';
import { SafetyPipeline } from '../src/security/pipeline.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';

const safety = new SafetyPipeline();

const configNoHITL = {
  safety: {
    enabled: true,
    allowedRiskLevels: ['read', 'write', 'execute', 'network'],
    blockedCommands: ['rm -rf /', 'format', 'del /s /q', 'mkfs', 'dd if='],
    blockedPaths: ['/etc', '/System', '/Windows/System32'],
    autoApprove: true,
    requireConfirmationFor: [],
  },
} as KairosConfigOutput;

const configWithHITL = {
  safety: {
    enabled: true,
    allowedRiskLevels: ['read', 'write', 'execute', 'network'],
    blockedCommands: [],
    blockedPaths: [],
    autoApprove: false,
    requireConfirmationFor: ['bash', 'write_file', 'edit_file'],
  },
} as KairosConfigOutput;

describe('Safety Pipeline - Blocked Commands', () => {
  test('blocks rm -rf /', async () => {
    const result = await safety.evaluate('bash', { command: 'rm -rf /' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('harm-detection');
  });

  test('blocks format command', async () => {
    const result = await safety.evaluate('bash', { command: 'format C:' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });

  test('blocks del /s /q', async () => {
    const result = await safety.evaluate('bash', { command: 'del /s /q C:\\' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });

  test('blocks mkfs', async () => {
    const result = await safety.evaluate('bash', { command: 'mkfs.ext4 /dev/sda' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });

  test('blocks dd if=', async () => {
    const result = await safety.evaluate('bash', { command: 'dd if=/dev/zero of=/dev/sda' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });
});

describe('Safety Pipeline - Destructive Intent Detection', () => {
  test('detects rm -rf pattern', async () => {
    const result = await safety.evaluate('bash', { command: 'rm -rf ~/backup' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Destructive');
  });

  test('allows safe commands', async () => {
    const result = await safety.evaluate('bash', { command: 'ls -la' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('allows echo command', async () => {
    const result = await safety.evaluate('bash', { command: 'echo hello' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('allows git commands', async () => {
    const result = await safety.evaluate('bash', { command: 'git status' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('allows npm commands', async () => {
    const result = await safety.evaluate('bash', { command: 'npm install' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });
});

describe('Safety Pipeline - HITL Confirmation', () => {
  test('requires confirmation for bash', async () => {
    const result = await safety.evaluate('bash', { command: 'ls' }, 'execute', configWithHITL, '.');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('hitl');
  });

  test('requires confirmation for write_file', async () => {
    const result = await safety.evaluate('write_file', { path: './test.txt', content: 'test' }, 'write', configWithHITL, '.');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('hitl');
  });

  test('autoApprove bypasses HITL', async () => {
    const result = await safety.evaluate('bash', { command: 'ls' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });
});

describe('Safety Pipeline - Safety Disabled', () => {
  test('disabled safety allows everything', async () => {
    const disabledConfig = {
      ...configNoHITL,
      safety: { ...configNoHITL.safety, enabled: false },
    } as KairosConfigOutput;
    const result = await safety.evaluate('bash', { command: 'rm -rf /' }, 'execute', disabledConfig, '.');
    expect(result.allowed).toBe(true);
    expect(result.layer).toBe('safety-disabled');
  });
});

describe('Safety Pipeline - Risk Classification', () => {
  test('read tools are allowed', async () => {
    const result = await safety.evaluate('read_file', { path: './test.txt' }, 'read', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('write tools are allowed when risk level included', async () => {
    const result = await safety.evaluate('write_file', { path: './test.txt', content: 'test' }, 'write', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('blocked risk levels are rejected', async () => {
    const restrictedConfig = {
      ...configNoHITL,
      safety: { ...configNoHITL.safety, allowedRiskLevels: ['read'] },
    } as KairosConfigOutput;
    const result = await safety.evaluate('write_file', { path: './test.txt', content: 'test' }, 'write', restrictedConfig, '.');
    expect(result.allowed).toBe(false);
    expect(result.layer).toBe('risk-classification');
  });
});

describe('Safety Pipeline - Network Protection', () => {
  test('allows http_fetch to public URLs', async () => {
    const result = await safety.evaluate('http_fetch', { url: 'https://example.com' }, 'network', configNoHITL, '.');
    expect(result.allowed).toBe(true);
  });

  test('blocks http_fetch to private IPs', async () => {
    const result = await safety.evaluate('http_fetch', { url: 'http://169.254.169.254/' }, 'network', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });

  test('blocks http_fetch to localhost', async () => {
    const result = await safety.evaluate('http_fetch', { url: 'http://localhost:8080/admin' }, 'network', configNoHITL, '.');
    expect(result.allowed).toBe(false);
  });
});

describe('Safety Pipeline - Audit Log', () => {
  test('evaluateWithAudit logs decisions', async () => {
    const result = await safety.evaluateWithAudit('bash', { command: 'rm -rf /' }, 'execute', configNoHITL, '.');
    expect(result.allowed).toBe(false);
    const log = safety.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    const lastEntry = log[log.length - 1]!;
    expect(lastEntry.toolName).toBe('bash');
    expect(lastEntry.allowed).toBe(false);
  });
});
