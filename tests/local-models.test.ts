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
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: LLAMACPP_URL,
    });
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) {
      console.log('  [SKIP] llama.cpp not running at ' + LLAMACPP_URL);
      return;
    }
    const result = await client.probe!();
    expect(result).toBe(true);
  });

  test('OllamaClient probe detects endpoint', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: OLLAMA_URL,
    });
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) {
      console.log('  [SKIP] Ollama not running at ' + OLLAMA_URL);
      return;
    }
    const result = await client.probe!();
    expect(result).toBe(true);
  });

  test('OllamaClient listModels returns model names', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: OLLAMA_URL,
    });
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) {
      console.log('  [SKIP] Ollama not running');
      return;
    }
    const models = await client.listModels();
    expect(Array.isArray(models)).toBe(true);
    console.log('  Ollama models: ' + models.join(', '));
  });

  test('LlamaCppClient chat works with legacy API', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: LLAMACPP_URL,
      timeout: 30000,
    });
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) {
      console.log('  [SKIP] llama.cpp not running');
      return;
    }
    const result = await client.chat([
      { role: 'user', content: 'Say exactly: Hello World' },
    ], { maxTokens: 20 });
    expect(result.content).toBeTruthy();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    console.log('  Response: ' + result.content);
  });

  test('LlamaCppClient streaming works', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: LLAMACPP_URL,
      timeout: 30000,
    });
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) {
      console.log('  [SKIP] llama.cpp not running');
      return;
    }
    const tokens: string[] = [];
    const startTime = Date.now();
    for await (const event of client.stream([
      { role: 'user', content: 'Say hi' },
    ], { maxTokens: 10 })) {
      if (event.type === 'token') tokens.push(event.content);
    }
    const elapsed = Date.now() - startTime;
    expect(tokens.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(30000); // Should complete within 30s
    console.log('  Streamed tokens: ' + tokens.join('') + ' (' + elapsed + 'ms)');
  }, 35000);

  test('LlamaCppClient streaming terminates cleanly', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: LLAMACPP_URL,
      timeout: 30000,
    });
    const reachable = await isReachable(LLAMACPP_URL);
    if (!reachable) {
      console.log('  [SKIP] llama.cpp not running');
      return;
    }
    let completed = false;
    let eventCount = 0;
    const startTime = Date.now();

    try {
      for await (const event of client.stream([
        { role: 'user', content: 'Say exactly: Done' },
      ], { maxTokens: 5 })) {
        eventCount++;
        if (event.type === 'done') {
          completed = true;
        }
      }
    } catch (err) {
      console.log('  Stream error: ' + (err instanceof Error ? err.message : String(err)));
    }

    const elapsed = Date.now() - startTime;
    expect(completed).toBe(true); // Must receive done event
    expect(eventCount).toBeGreaterThanOrEqual(1); // At least done event
    expect(elapsed).toBeLessThan(30000); // Must not hang
    console.log('  Stream completed: ' + eventCount + ' events in ' + elapsed + 'ms');
  }, 35000);

  test('OllamaClient chat works', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: OLLAMA_URL,
      timeout: 60000,
    });
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) {
      console.log('  [SKIP] Ollama not running');
      return;
    }
    const models = await client.listModels();
    if (models.length === 0) {
      console.log('  [SKIP] No Ollama models installed');
      return;
    }
    const result = await client.chat([
      { role: 'user', content: 'Say exactly: Hello World' },
    ], { model: models[0], maxTokens: 20 });
    expect(result.content).toBeTruthy();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
    console.log('  Response: ' + result.content);
  });

  test('OllamaClient streaming works', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: OLLAMA_URL,
      timeout: 60000,
    });
    const reachable = await isReachable(OLLAMA_URL);
    if (!reachable) {
      console.log('  [SKIP] Ollama not running');
      return;
    }
    const models = await client.listModels();
    if (models.length === 0) {
      console.log('  [SKIP] No Ollama models installed');
      return;
    }
    const tokens: string[] = [];
    for await (const event of client.stream([
      { role: 'user', content: 'Say hi' },
    ], { model: models[0], maxTokens: 10 })) {
      if (event.type === 'token') tokens.push(event.content);
    }
    expect(tokens.length).toBeGreaterThan(0);
    console.log('  Streamed tokens: ' + tokens.join(''));
  });

  test('LlamaCppClient handles connection refused gracefully', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: 'http://localhost:19999',
      timeout: 3000,
    });
    const start = Date.now();
    try {
      await client.chat([{ role: 'user', content: 'test' }]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const elapsed = Date.now() - start;
      // Should fail within retry timeout, not hang indefinitely
      expect(elapsed).toBeLessThan(20000);
      console.log('  Connection refused error handled in ' + elapsed + 'ms');
    }
  }, 20000);

  test('LlamaCppClient handles invalid URL gracefully', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: 'http://invalid.invalid',
      timeout: 3000,
    });
    const start = Date.now();
    try {
      await client.chat([{ role: 'user', content: 'test' }]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20000);
      console.log('  Invalid URL error handled in ' + elapsed + 'ms');
    }
  }, 20000);

  test('OllamaClient handles connection refused gracefully', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: 'http://localhost:19999',
      timeout: 3000,
    });
    const start = Date.now();
    try {
      await client.chat([{ role: 'user', content: 'test' }]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20000);
      console.log('  Connection refused error handled in ' + elapsed + 'ms');
    }
  }, 20000);

  test('LlamaCppClient probe returns false for unreachable endpoint', async () => {
    const client = new LlamaCppClient({
      provider: 'llamacpp',
      model: 'local',
      baseUrl: 'http://localhost:19999',
    });
    const result = await client.probe!();
    expect(result).toBe(false);
  });

  test('OllamaClient probe returns false for unreachable endpoint', async () => {
    const client = new OllamaClient({
      provider: 'ollama',
      model: 'llama3',
      baseUrl: 'http://localhost:19999',
    });
    const result = await client.probe!();
    expect(result).toBe(false);
  });
});

describe('LLM Provider Manager - Auto-Discovery', () => {
  test('discoverLocal finds running services', async () => {
    const manager = new LLMProviderManager({ autoDiscoverLocal: true });
    const results = await manager.discoverLocal();
    expect(Array.isArray(results)).toBe(true);
    const available = results.filter((r) => r.available);
    console.log('  Discovered: ' + results.map((r) => `${r.name}=${r.available ? 'yes' : 'no'}`).join(', '));
  });

  test('switchTo fails gracefully for unavailable provider', async () => {
    const manager = new LLMProviderManager();
    const switched = await manager.switchTo('nonexistent-provider');
    expect(switched).toBe(false);
  });

  test('validateConnection reports status', async () => {
    const manager = new LLMProviderManager({ preferredProvider: 'llamacpp' });
    const status = await manager.validateConnection();
    expect(status).toHaveProperty('available');
    expect(status).toHaveProperty('provider');
    console.log('  Validation: ' + JSON.stringify(status));
  });

  test('listProviders returns all providers', async () => {
    const manager = new LLMProviderManager();
    const providers = manager.listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(10);
    const localProviders = providers.filter((p) => p.isLocal);
    expect(localProviders.length).toBeGreaterThanOrEqual(5);
  });
});

describe('GGUF Metadata Extraction', () => {
  test('extractGGUFMetadata returns empty for non-GGUF file', async () => {
    const meta = await extractGGUFMetadata('package.json');
    expect(meta).toEqual({});
  });

  test('extractGGUFMetadata returns empty for nonexistent file', async () => {
    const meta = await extractGGUFMetadata('/nonexistent/file.gguf');
    expect(meta).toEqual({});
  });
});

describe('createLLMClient - Provider Routing', () => {
  test('creates correct client for each provider', () => {
    const providers = [
      { name: 'llamacpp', expected: 'LlamaCppClient' },
      { name: 'openai', expected: 'OpenAIClient' },
      { name: 'azure', expected: 'OpenAIClient' },
      { name: 'groq', expected: 'OpenAIClient' },
      { name: 'together', expected: 'OpenAIClient' },
      { name: 'deepseek', expected: 'OpenAIClient' },
      { name: 'mistral', expected: 'OpenAIClient' },
      { name: 'lmstudio', expected: 'OpenAIClient' },
      { name: 'oobabooga', expected: 'TextGenWebUIClient' },
      { name: 'localai', expected: 'LocalAIClient' },
      { name: 'replicate', expected: 'ReplicateClient' },
      { name: 'ollama', expected: 'OllamaClient' },
      { name: 'anthropic', expected: 'AnthropicClient' },
      { name: 'gemini', expected: 'GeminiClient' },
      { name: 'cohere', expected: 'CohereClient' },
    ];

    for (const { name, expected } of providers) {
      const client = createLLMClient({
        provider: name as any,
        model: 'test',
        baseUrl: 'http://localhost:8080',
      });
      expect(client.constructor.name).toBe(expected);
    }
  });
});

describe('LocalAI Client - Multi-Model Support', () => {
  test('LocalAIClient has loadModel/unloadModel methods', async () => {
    const client = createLLMClient({
      provider: 'localai',
      model: 'test',
      baseUrl: 'http://localhost:19999',
    }) as any;
    expect(typeof client.loadModel).toBe('function');
    expect(typeof client.unloadModel).toBe('function');
    expect(typeof client.getLoadedModels).toBe('function');
    expect(typeof client.listModels).toBe('function');
  });

  test('LocalAIClient probe returns false for unreachable endpoint', async () => {
    const client = createLLMClient({
      provider: 'localai',
      model: 'test',
      baseUrl: 'http://localhost:19999',
    });
    if (client.probe) {
      const result = await client.probe();
      expect(result).toBe(false);
    }
  });
});

describe('TextGenWebUI Client', () => {
  test('TextGenWebUIClient has listModels method', async () => {
    const client = createLLMClient({
      provider: 'oobabooga',
      model: 'test',
      baseUrl: 'http://localhost:19999',
    }) as any;
    expect(typeof client.listModels).toBe('function');
  });

  test('TextGenWebUIClient probe returns false for unreachable endpoint', async () => {
    const client = createLLMClient({
      provider: 'oobabooga',
      model: 'test',
      baseUrl: 'http://localhost:19999',
    });
    if (client.probe) {
      const result = await client.probe();
      expect(result).toBe(false);
    }
  });
});

describe('Replicate Client', () => {
  test('ReplicateClient handles missing API token gracefully', async () => {
    const client = createLLMClient({
      provider: 'replicate',
      model: 'test',
      baseUrl: 'https://api.replicate.com/v1',
    });
    try {
      await client.chat([{ role: 'user', content: 'test' }]);
      expect(true).toBe(false); // Should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });
});
