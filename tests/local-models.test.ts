import { describe, test, expect } from 'bun:test';
import { LlamaCppClient, OllamaClient, createLLMClient } from '../src/llm/client.ts';
import { LLMProviderManager } from '../src/llm/manager.ts';
import { LOCAL_PROVIDERS, extractGGUFMetadata } from '../src/llm/providers.ts';

const LLAMACPP_URL = process.env['LLAMACPP_URL'] ?? 'http://localhost:8080';
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://localhost:11434';

async function isReachable(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

describe('LLM Client - Connection & Retry', () => {
  test('LlamaCppClient probe detects endpoint', async () => {
    const client = new LlamaCppClient({ provider: 'llamacpp', model: 'local', baseUrl: LLAMACPP_URL });
    const result = await client.probe!();
    const reachable = await isReachable(LLAMACPP_URL);
    expect(result).toBe(reachable);
  });

  test('OllamaClient probe detects endpoint', async () => {
    const client = new OllamaClient({ provider: 'ollama', model: 'llama3', baseUrl: OLLAMA_URL });
    const result = await client.probe!();
    const reachable = await isReachable(OLLAMA_URL);
    expect(result).toBe(reachable);
  });

  test('OllamaClient listModels returns array', async () => {
    const client = new OllamaClient({ provider: 'ollama', model: 'llama3', baseUrl: OLLAMA_URL });
    const models = await client.listModels();
    expect(Array.isArray(models)).toBe(true);
  });

  test('LlamaCppClient chat works when reachable', async () => {
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) return;
    const client = new LlamaCppClient({ provider: 'llamacpp', model: 'local', baseUrl: LLAMACPP_URL, timeout: 10000 });
    const result = await client.chat([{ role: 'user', content: 'Say hello' }], { maxTokens: 20 });
    expect(result.content).toBeTruthy();
  });

  test('LlamaCppClient streaming works when reachable', async () => {
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) return;
    const client = new LlamaCppClient({ provider: 'llamacpp', model: 'local', baseUrl: LLAMACPP_URL, timeout: 10000 });
    const tokens: string[] = [];
    for await (const event of client.stream([{ role: 'user', content: 'Say hi' }], { maxTokens: 10 })) {
      if (event.type === 'token') tokens.push(event.content);
    }
    expect(tokens.length).toBeGreaterThan(0);
  });

  test('OllamaClient chat works when reachable', async () => {
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) return;
    const client = new OllamaClient({ provider: 'ollama', model: 'llama3', baseUrl: OLLAMA_URL, timeout: 10000 });
    const result = await client.chat([{ role: 'user', content: 'Say hello' }], { maxTokens: 10 });
    expect(result.content).toBeTruthy();
  });

  test('OllamaClient streaming works when reachable', async () => {
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) return;
    const client = new OllamaClient({ provider: 'ollama', model: 'llama3', baseUrl: OLLAMA_URL, timeout: 10000 });
    const tokens: string[] = [];
    for await (const event of client.stream([{ role: 'user', content: 'Say hi' }], { maxTokens: 10 })) {
      if (event.type === 'token') tokens.push(event.content);
    }
    expect(tokens.length).toBeGreaterThan(0);
  });
});

describe('LLM Provider Manager - Fallback', () => {
  test('getBest returns provider with API key', () => {
    process.env['OPENAI_API_KEY'] = 'test-key';
    const manager = new LLMProviderManager({ preferredProvider: 'openai' });
    const provider = manager.getActiveProvider();
    expect(provider.name).toBe('openai');
    delete process.env['OPENAI_API_KEY'];
  });

  test('discoverLocal probes all local providers', async () => {
    const manager = new LLMProviderManager({ autoDiscoverLocal: true });
    const results = await manager.discoverLocal();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  test('validateConnection returns status', async () => {
    const manager = new LLMProviderManager({ preferredProvider: 'llamacpp' });
    const status = await manager.validateConnection();
    expect(typeof status.available).toBe('boolean');
    expect(status.provider).toBe('llamacpp');
  });

  test('listProviders returns all providers', () => {
    const manager = new LLMProviderManager();
    const providers = manager.listProviders();
    expect(providers.length).toBeGreaterThan(10);
  });

  test('switchTo changes active provider', async () => {
    const manager = new LLMProviderManager({ preferredProvider: 'anthropic' });
    expect(manager.getActiveProvider().name).toBe('anthropic');
    const switched = await manager.switchTo('openai');
    expect(typeof switched).toBe('boolean');
  });
});

describe('Local Provider Definitions', () => {
  test('LOCAL_PROVIDERS has all expected providers', () => {
    expect(LOCAL_PROVIDERS.length).toBeGreaterThanOrEqual(5);
  });

  test('each provider has required fields', () => {
    for (const p of LOCAL_PROVIDERS) {
      expect(typeof p.name).toBe('string');
      expect(typeof p.baseUrl).toBe('string');
      expect(p.isLocal).toBe(true);
    }
  });

  test('GGUF metadata extraction handles missing file', async () => {
    const meta = await extractGGUFMetadata('/nonexistent/file.gguf');
    expect(meta).toEqual({});
  });

  test('createLLMClient returns correct client type', () => {
    const llama = createLLMClient({ provider: 'llamacpp', model: 'local' });
    expect(llama).toBeInstanceOf(LlamaCppClient);
    const ollama = createLLMClient({ provider: 'ollama', model: 'llama3' });
    expect(ollama).toBeInstanceOf(OllamaClient);
  });
});

describe('Connection Error Handling', () => {
  test('probe handles unreachable endpoint', async () => {
    const client = new LlamaCppClient({ provider: 'llamacpp', model: 'local', baseUrl: 'http://localhost:99999', timeout: 3000 });
    const result = await client.probe!();
    expect(result).toBe(false);
  });

  test('probe handles invalid URL', async () => {
    const client = new LlamaCppClient({ provider: 'llamacpp', model: 'local', baseUrl: 'not-a-url', timeout: 3000 });
    const result = await client.probe!();
    expect(result).toBe(false);
  });
});
