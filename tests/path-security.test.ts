import { describe, test, expect } from 'bun:test';
import { resolveFilePath, isPathSafe, sanitizePath } from '../src/utils/path_security.ts';
import { join } from 'path';

describe('PathResolver', () => {
  const workspaceRoot = join(process.cwd(), 'test-workspace');

  test('sanitizePath removes null bytes', () => {
    expect(sanitizePath('src\0/main.ts')).toBe('src/main.ts');
  });

  test('sanitizePath removes special characters', () => {
    expect(sanitizePath('src<>:"|?*main.ts')).toBe('srcmain.ts');
  });

  test('isPathSafe returns true for relative paths', () => {
    expect(isPathSafe('src/main.ts', workspaceRoot)).toBe(true);
  });

  test('isPathSafe returns false for absolute paths outside workspace', () => {
    if (process.platform === 'win32') {
      expect(isPathSafe('C:\\Windows\\System32\\config', workspaceRoot)).toBe(false);
    } else {
      expect(isPathSafe('/etc/passwd', workspaceRoot)).toBe(false);
    }
  });
});
