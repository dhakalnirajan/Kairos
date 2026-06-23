import { describe, test, expect } from 'bun:test';
import { globTool } from '../src/tools/builtin/file/glob.ts';
import { grepTool } from '../src/tools/builtin/file/grep.ts';
import { editFileTool } from '../src/tools/builtin/file/edit_file.ts';
import { httpFetchTool } from '../src/tools/builtin/web/http_fetch.ts';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';

const testDir = join(process.cwd(), '_test_glob_grep');
const ctx = { workspaceRoot: testDir, sessionId: 'test' };

function setup() {
  mkdirSync(join(testDir, 'src'), { recursive: true });
  writeFileSync(join(testDir, 'src', 'main.ts'), 'export const x = 1;\nexport const y = 2;\n');
  writeFileSync(join(testDir, 'src', 'utils.ts'), 'export function helper() { return "help"; }\n');
  writeFileSync(join(testDir, 'README.md'), '# Test Project\n');
}

function cleanup() {
  rmSync(testDir, { recursive: true, force: true });
}

describe('glob tool', () => {
  test('finds matching files', async () => {
    setup();
    const result = await globTool.execute({ pattern: '**/*.ts' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('main.ts');
    expect(result.output).toContain('utils.ts');
    cleanup();
  });

  test('returns no match for nonexistent pattern', async () => {
    setup();
    const result = await globTool.execute({ pattern: '**/*.xyz' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe('No files found');
    cleanup();
  });

  test('finds by extension', async () => {
    setup();
    const result = await globTool.execute({ pattern: '*.md' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('README.md');
    cleanup();
  });
});

describe('grep tool', () => {
  test('finds matching lines', async () => {
    setup();
    const result = await grepTool.execute({ pattern: 'export' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('main.ts');
    expect(result.output).toContain('export');
    cleanup();
  });

  test('respects include filter', async () => {
    setup();
    const result = await grepTool.execute({ pattern: 'export', include: '*.md' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toBe('No matches found');
    cleanup();
  });

  test('finds in specific files', async () => {
    setup();
    const result = await grepTool.execute({ pattern: 'helper' }, ctx);
    expect(result.success).toBe(true);
    expect(result.output).toContain('utils.ts');
    cleanup();
  });
});

describe('edit_file tool', () => {
  test('replaces exact string', async () => {
    setup();
    const filePath = join(testDir, 'src', 'main.ts');
    const result = await editFileTool.execute(
      { path: filePath, oldString: 'export const x = 1;', newString: 'export const x = 100;' },
      ctx,
    );
    expect(result.success).toBe(true);
    const content = require('fs').readFileSync(filePath, 'utf-8');
    expect(content).toContain('export const x = 100;');
    cleanup();
  });

  test('fails on non-unique match', async () => {
    setup();
    const filePath = join(testDir, 'src', 'main.ts');
    const result = await editFileTool.execute(
      { path: filePath, oldString: 'export', newString: 'import' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('2 matches');
    cleanup();
  });

  test('fails on missing string', async () => {
    setup();
    const filePath = join(testDir, 'src', 'main.ts');
    const result = await editFileTool.execute(
      { path: filePath, oldString: 'NONEXISTENT', newString: 'test' },
      ctx,
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    cleanup();
  });
});

describe('http_fetch tool', () => {
  test('blocks private IPs', async () => {
    const result = await httpFetchTool.execute(
      { url: 'http://127.0.0.1:8080/test' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('private');
  });

  test('blocks metadata endpoint', async () => {
    const result = await httpFetchTool.execute(
      { url: 'http://169.254.169.254/metadata' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(false);
  });

  test('blocks non-http protocols', async () => {
    const result = await httpFetchTool.execute(
      { url: 'file:///etc/passwd' },
      { workspaceRoot: process.cwd(), sessionId: 'test' },
    );
    expect(result.success).toBe(false);
  });
});
