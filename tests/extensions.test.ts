import { describe, test, expect } from 'bun:test';
import { ExtensionLoader } from '../src/extensions/loader.ts';
import { SkillRunner } from '../src/skills/runner.ts';
import { MCPClient } from '../src/mcp/client.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';
import { join } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';

describe('ExtensionLoader', () => {
  test('discovers extensions from search path', async () => {
    const testDir = join(process.cwd(), '_test_ext');
    const extDir = join(testDir, 'myext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({
      name: 'test-ext',
      version: '1.0.0',
      skills: ['test-skill'],
      tools: ['test-tool'],
    }));

    const config = { extensions: { enabled: true, searchPaths: [testDir], disabled: [] } } as unknown as KairosConfigOutput;
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(1);
    expect(extensions[0]?.manifest.name).toBe('test-ext');
    rmSync(testDir, { recursive: true, force: true });
  });

  test('skips disabled extensions', async () => {
    const testDir = join(process.cwd(), '_test_ext2');
    const extDir = join(testDir, 'disabled-ext');
    mkdirSync(extDir, { recursive: true });
    writeFileSync(join(extDir, 'manifest.json'), JSON.stringify({ name: 'disabled-ext' }));

    const config = { extensions: { enabled: true, searchPaths: [testDir], disabled: ['disabled-ext'] } } as unknown as KairosConfigOutput;
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(1);
    expect(extensions[0]?.enabled).toBe(false);
    rmSync(testDir, { recursive: true, force: true });
  });

  test('returns empty when disabled', async () => {
    const config = { extensions: { enabled: false, searchPaths: [], disabled: [] } } as unknown as KairosConfigOutput;
    const loader = new ExtensionLoader(config);
    const extensions = await loader.discover();
    expect(extensions.length).toBe(0);
  });
});

describe('SkillRunner', () => {
  test('loads skills from markdown files', async () => {
    const testDir = join(process.cwd(), '_test_skills', 'review');
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, 'SKILL.md'), '---\nname: code-review\ndescription: Review code\ntools:\n  - read_file\n---\nSystem prompt content');

    const runner = new SkillRunner();
    const skills = await runner.loadSkills(join(process.cwd(), '_test_skills'));
    expect(skills.length).toBe(1);
    expect(skills[0]?.name).toBe('code-review');
    rmSync(join(process.cwd(), '_test_skills'), { recursive: true, force: true });
  });

  test('returns empty for nonexistent dir', async () => {
    const runner = new SkillRunner();
    const skills = await runner.loadSkills('/nonexistent/path');
    expect(skills.length).toBe(0);
  });
});

describe('MCPClient', () => {
  test('addServer handles connection failure', async () => {
    const client = new MCPClient();
    const server = await client.addServer({ name: 'test', transport: 'sse', url: 'http://localhost:99999' });
    expect(server.connected).toBe(false);
  });

  test('getServers returns added servers', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 's1', transport: 'sse', url: 'http://localhost:99999' });
    const servers = client.getServers();
    expect(servers.length).toBe(1);
    expect(servers[0]?.config.name).toBe('s1');
  });

  test('getTools aggregates from servers', async () => {
    const client = new MCPClient();
    await client.addServer({ name: 's1', transport: 'sse', url: 'http://localhost:99999' });
    const tools = client.getTools();
    expect(tools.length).toBe(0);
  });
});
