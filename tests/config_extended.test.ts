import { describe, test, expect } from 'bun:test';
import { loadConfig, saveConfig, resetConfig } from '../src/config/index.ts';
import { KairosConfigSchema } from '../src/config/schema.ts';

describe('Config Loader', () => {
  test('loadConfig returns valid config', async () => {
    const config = await loadConfig();
    expect(config).toBeDefined();
    expect(config.version).toBe('0.1.1');
    expect(config.llm).toBeDefined();
    expect(config.safety).toBeDefined();
  });

  test('loadConfig applies CLI flags', async () => {
    const config = await loadConfig({ provider: 'ollama', model: 'llama3' });
    expect(config.llm.provider).toBe('ollama');
    expect(config.llm.model).toBe('llama3');
  });

  test('loadConfig sets provider-specific defaults', async () => {
    const config = await loadConfig({ provider: 'llamacpp' });
    expect(config.llm.baseUrl).toContain('localhost');
  });

  test('loadConfig applies env vars', async () => {
    process.env.KAIROS_LLM_MODEL = 'test-model';
    const config = await loadConfig();
    expect(config.llm.model).toBe('test-model');
    delete process.env.KAIROS_LLM_MODEL;
  });

  test('saveConfig writes to disk', async () => {
    const config = await loadConfig();
    await saveConfig(config);
    const reloaded = await loadConfig();
    expect(reloaded.version).toBe(config.version);
  });

  test('resetConfig restores defaults', async () => {
    const config = await resetConfig();
    expect(config.version).toBe('0.1.1');
    expect(config.llm.provider).toBe('anthropic');
  });

  test('config validates against schema', async () => {
    const config = await loadConfig();
    const result = KairosConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
