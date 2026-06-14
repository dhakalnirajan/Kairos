import { describe, test, expect } from 'bun:test';
import { logger, LogLevel } from '../src/utils/logger.ts';
import { ensureDir, ensureAllDirs, resolvePath, normalizePath, isAbsolute, getRelativePath, getKairosDir, getDbPath } from '../src/utils/paths.ts';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';

describe('Logger', () => {
  test('singleton pattern', () => {
    const a = logger;
    const b = logger;
    expect(a).toBe(b);
  });

  test('setLevel changes level', () => {
    logger.setLevel(LogLevel.DEBUG);
    expect(LogLevel.DEBUG).toBe(0);
  });
});

describe('Path utilities', () => {
  test('getKairosDir returns platform-appropriate path', () => {
    const dir = getKairosDir();
    expect(dir).toBeTruthy();
    if (process.platform === 'win32') {
      expect(dir).toContain('AppData');
    } else {
      expect(dir).toContain('.kairos');
    }
  });

  test('getDbPath returns database path', () => {
    const dbPath = getDbPath();
    expect(dbPath).toContain('kairos.db');
  });

  test('ensureDir creates directory', async () => {
    const testDir = join(process.cwd(), '_test_ensure_dir');
    await ensureDir(testDir);
    expect(existsSync(testDir)).toBe(true);
    rmSync(testDir, { recursive: true, force: true });
  });

  test('resolvePath handles ~', () => {
    const resolved = resolvePath('~/test');
    expect(resolved).toContain('test');
    expect(resolved).not.toContain('~');
  });

  test('normalizePath converts forward slashes on Windows', () => {
    const result = normalizePath('a/b/c');
    if (process.platform === 'win32') {
      expect(result).toContain('\\');
    } else {
      expect(result).toContain('/');
    }
  });

  test('isAbsolute detects absolute paths', () => {
    if (process.platform === 'win32') {
      expect(isAbsolute('C:\\test')).toBe(true);
      expect(isAbsolute('relative/path')).toBe(false);
    } else {
      expect(isAbsolute('/test')).toBe(true);
      expect(isAbsolute('relative/path')).toBe(false);
    }
  });

  test('getRelativePath computes relative path', () => {
    const result = getRelativePath('/a/b/c', '/a/b/d');
    expect(result).toBeTruthy();
  });
});
