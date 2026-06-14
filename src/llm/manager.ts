import type { LLMConfig, ChatMessage, ChatOptions, ChatResult, StreamEvent } from '../types/index.ts';
import { createLLMClient, type LLMClient } from './client.ts';
import {
  ALL_PROVIDERS,
  LOCAL_PROVIDERS,
  getProviderByName,
  type ProviderDefinition,
} from './providers.ts';

export interface ProviderStatus {
  name: string;
  available: boolean;
  latencyMs?: number;
  error?: string;
  models?: string[];
}

export interface ManagerConfig {
  preferredProvider?: string;
  fallbackEnabled?: boolean;
  autoDiscoverLocal?: boolean;
  apiKey?: string;
}

async function probeUrl(url: string, timeoutMs = 2000): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: res.ok || res.status === 404, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function probeLocalProvider(provider: ProviderDefinition): Promise<ProviderStatus> {
  const primaryProbe = `${provider.baseUrl}/v1/models`;
  const altProbe = `${provider.baseUrl}/api/tags`;

  const result = await probeUrl(primaryProbe);
  if (result.ok) {
    return { name: provider.name, available: true, latencyMs: result.latencyMs };
  }

  const altResult = await probeUrl(altProbe);
  if (altResult.ok) {
    return { name: provider.name, available: true, latencyMs: altResult.latencyMs };
  }

  return { name: provider.name, available: false, latencyMs: result.latencyMs };
}

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

export class LLMProviderManager {
  private config: ManagerConfig;
  private activeProvider: ProviderDefinition;
  private activeClient: LLMClient;
  private fallbackChain: ProviderDefinition[];
  private discoveredLocal: ProviderStatus[] = [];

  constructor(config: ManagerConfig = {}) {
    this.config = config;
    this.activeProvider = this.resolveInitialProvider();
    this.activeClient = createLLMClient(this.buildLLMConfig(this.activeProvider, config.apiKey));
    this.fallbackChain = this.buildFallbackChain();
  }

  private resolveInitialProvider(): ProviderDefinition {
    if (this.config.preferredProvider) {
      const found = getProviderByName(this.config.preferredProvider);
      if (found) return found;
    }
    return ALL_PROVIDERS.find((p) => p.name === 'anthropic')!;
  }

  private buildFallbackChain(): ProviderDefinition[] {
    return ALL_PROVIDERS.filter((p) => p.name !== this.activeProvider.name);
  }

  private buildLLMConfig(provider: ProviderDefinition, apiKey?: string): LLMConfig {
    const envKey = provider.envKey ? process.env[provider.envKey] : undefined;
    const key = apiKey ?? envKey ?? undefined;
    return {
      provider: provider.name as LLMConfig['provider'],
      model: provider.defaultModel,
      baseUrl: provider.baseUrl,
      apiKey: key,
      temperature: 0.7,
      maxTokens: 4096,
    };
  }

  async discoverLocal(): Promise<ProviderStatus[]> {
    const probes = LOCAL_PROVIDERS.map((p) => probeLocalProvider(p));
    this.discoveredLocal = await Promise.all(probes);

    for (const status of this.discoveredLocal) {
      if (status.available) {
        const provider = getProviderByName(status.name);
        if (provider && status.name === 'ollama') {
          provider.models = await fetchOllamaModels(provider.baseUrl);
          status.models = provider.models;
        }
      }
    }

    return this.discoveredLocal;
  }

  getDiscoveredLocal(): ProviderStatus[] {
    return this.discoveredLocal;
  }

  listProviders(): Array<ProviderDefinition & { available?: boolean }> {
    return ALL_PROVIDERS.map((p) => {
      const status = this.discoveredLocal.find((s) => s.name === p.name);
      return { ...p, available: status?.available ?? (p.isLocal ? undefined : true) };
    });
  }

  getActiveProvider(): ProviderDefinition {
    return this.activeProvider;
  }

  getActiveClient(): LLMClient {
    return this.activeClient;
  }

  async switchTo(name: string, apiKey?: string): Promise<boolean> {
    const provider = getProviderByName(name);
    if (!provider) return false;

    const client = createLLMClient(this.buildLLMConfig(provider, apiKey));
    if (client.probe) {
      const available = await client.probe();
      if (!available) return false;
    }

    this.activeProvider = provider;
    this.activeClient = client;
    return true;
  }

  async validateConnection(): Promise<{ available: boolean; provider: string; error?: string }> {
    try {
      if (this.activeClient.probe) {
        const available = await this.activeClient.probe();
        return {
          available,
          provider: this.activeProvider.name,
          error: available ? undefined : "Probe failed",
        };
      }
      await this.activeClient.chat([{ role: "user", content: "ping" }], { maxTokens: 1 });
      return { available: true, provider: this.activeProvider.name };
    } catch (err) {
      return {
        available: false,
        provider: this.activeProvider.name,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    try {
      return await this.activeClient.chat(messages, opts);
    } catch (err) {
      if (!this.config.fallbackEnabled) throw err;
      return this.fallbackChat(messages, opts, err);
    }
  }

  private async fallbackChat(
    messages: ChatMessage[],
    opts: ChatOptions | undefined,
    lastError: unknown,
  ): Promise<ChatResult> {
    for (const provider of this.fallbackChain) {
      const envKey = provider.envKey ? process.env[provider.envKey] : undefined;
      if (provider.isLocal || envKey) {
        try {
          const client = createLLMClient(this.buildLLMConfig(provider));
          return await client.chat(messages, opts);
        } catch {
          continue;
        }
      }
    }
    throw lastError;
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    try {
      yield* this.activeClient.stream(messages, opts);
    } catch (err) {
      if (!this.config.fallbackEnabled) throw err;
      yield* this.fallbackStream(messages, opts, err);
    }
  }

  private async *fallbackStream(
    messages: ChatMessage[],
    opts: ChatOptions | undefined,
    lastError: unknown,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    for (const provider of this.fallbackChain) {
      const envKey = provider.envKey ? process.env[provider.envKey] : undefined;
      if (provider.isLocal || envKey) {
        try {
          const client = createLLMClient(this.buildLLMConfig(provider));
          yield* client.stream(messages, opts);
          return;
        } catch {
          continue;
        }
      }
    }
    throw lastError;
  }
}
