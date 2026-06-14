import type {
  LLMConfig,
  ChatMessage,
  ChatOptions,
  ChatResult,
  StreamEvent,
  EmbeddingResult,
} from "../types/index.ts";

export type { LLMConfig, ChatMessage, ChatOptions, ChatResult, StreamEvent, EmbeddingResult };

const DEFAULT_TIMEOUT = 30_000;
const LOCAL_TIMEOUT = 120_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const STREAM_READ_TIMEOUT_MS = 30_000;
const STREAM_IDLE_TIMEOUT_MS = 60_000;

const CONTROL_CHARS = /[\x00-\x08\x0E-\x1F\x7F]/g;
const ANSI_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]/g;

function sanitizeOutput(text: string): string {
  return text
    .replace(CONTROL_CHARS, "")
    .replace(ANSI_PATTERN, "")
    .normalize("NFC");
}

function parseSSELine(line: string): Record<string, unknown> | null {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6);
  if (data === "[DONE]") return null;
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildChatPayload(
  messages: ChatMessage[],
  opts: ChatOptions | undefined,
  model: string,
): Record<string, unknown> {
  return {
    model: opts?.model ?? model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: opts?.temperature ?? 0.7,
    max_tokens: opts?.maxTokens ?? 4096,
    ...(opts?.stop ? { stop: opts.stop } : {}),
  };
}

function extractUsage(
  data: Record<string, unknown>,
): { promptTokens: number; completionTokens: number } {
  const usage = data["usage"] as Record<string, unknown> | undefined;
  return {
    promptTokens: (usage?.["prompt_tokens"] as number) ?? 0,
    completionTokens: (usage?.["completion_tokens"] as number) ?? 0,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readWithTimeout(
  reader: { read(): Promise<{ done: boolean; value?: Uint8Array }> },
  timeoutMs: number,
): Promise<{ done: boolean; value?: Uint8Array }> {
  return Promise.race([
    reader.read(),
    new Promise<{ done: true; value: undefined }>((_, reject) =>
      setTimeout(() => reject(new Error(`Read timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
  retryDelay: number = RETRY_DELAY_MS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err) {
      lastError = err;
      const isConnectionError = err instanceof Error && (
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('fetch failed')
      );
      if (isConnectionError && attempt === 0) {
        // Don't retry connection errors on first attempt, fail fast
        throw err;
      }
      if (attempt < retries) {
        await sleep(retryDelay * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

export abstract class LLMClient {
  protected config: LLMConfig;
  protected timeout: number;

  constructor(config: LLMConfig) {
    this.config = config;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  abstract chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  abstract stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined>;
  abstract embed(text: string): Promise<EmbeddingResult>;

  async probe?(): Promise<boolean>;
}

export class LlamaCppClient extends LLMClient {
  private baseUrl: string;
  private useLegacyApi: boolean | null = null;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? "http://localhost:8080";
    this.timeout = config.timeout ?? LOCAL_TIMEOUT;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/v1/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }, 1, 500);
      if (res.ok) {
        this.useLegacyApi = false;
        return true;
      }
      const legacyRes = await fetchWithRetry(`${this.baseUrl}/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "test", n_predict: 1 }),
        signal: AbortSignal.timeout(5000),
      }, 1, 500);
      if (legacyRes.ok || legacyRes.status === 400) {
        this.useLegacyApi = true;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private getEndpoints(): { chat: string; completion: string } {
    if (this.useLegacyApi === true) {
      return {
        chat: `${this.baseUrl}/completion`,
        completion: `${this.baseUrl}/completion`,
      };
    }
    return {
      chat: `${this.baseUrl}/v1/chat/completions`,
      completion: `${this.baseUrl}/v1/completions`,
    };
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const endpoints = this.getEndpoints();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.useLegacyApi === true) {
        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
        const res = await fetchWithRetry(endpoints.chat, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            n_predict: opts?.maxTokens ?? 4096,
            temperature: opts?.temperature ?? 0.7,
            stream: false,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`LlamaCpp chat failed (${res.status}): ${body}`);
        }
        const data = (await res.json()) as Record<string, unknown>;
        return {
          content: sanitizeOutput((data["content"] as string) ?? ""),
          usage: {
            promptTokens: (data["prompt_eval_count"] as number) ?? 0,
            completionTokens: (data["eval_count"] as number) ?? 0,
            totalTokens: ((data["prompt_eval_count"] as number) ?? 0) + ((data["eval_count"] as number) ?? 0),
          },
        };
      }

      const payload = buildChatPayload(messages, opts, this.config.model);
      const res = await fetchWithRetry(endpoints.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: false }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LlamaCpp chat failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const choices = data["choices"] as Array<Record<string, unknown>> | undefined;
      const message = (choices?.[0]?.["message"] ?? {}) as Record<string, unknown>;
      const usage = extractUsage(data);
      return {
        content: sanitizeOutput((message["content"] as string) ?? ""),
        usage: { ...usage, totalTokens: usage.promptTokens + usage.completionTokens },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const endpoints = this.getEndpoints();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.useLegacyApi === true) {
        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
        const res = await fetchWithRetry(endpoints.chat, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            n_predict: opts?.maxTokens ?? 4096,
            temperature: opts?.temperature ?? 0.7,
            stream: true,
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`LlamaCpp stream failed (${res.status}): ${body}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let promptTokens = 0;
        let completionTokens = 0;
        let lastActivity = Date.now();

        try {
          while (true) {
            if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
              throw new Error("Stream idle timeout - no data received");
            }
            const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
            if (done) break;
            lastActivity = Date.now();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const data = JSON.parse(trimmed) as Record<string, unknown>;
                const content = data["content"] as string | undefined;
                if (content) yield { type: "token", content: sanitizeOutput(content) };
                if (data["stop"] === true) {
                  promptTokens = (data["prompt_eval_count"] as number) ?? 0;
                  completionTokens = (data["eval_count"] as number) ?? 0;
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        yield { type: "done", usage: { promptTokens, completionTokens } };
        return;
      }

      const payload = buildChatPayload(messages, opts, this.config.model);
      const res = await fetchWithRetry(endpoints.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LlamaCpp stream failed (${res.status}): ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseSSELine(trimmed);
            if (!parsed) continue;
            const choices = parsed["choices"] as Array<Record<string, unknown>> | undefined;
            const delta = (choices?.[0]?.["delta"] ?? {}) as Record<string, unknown>;
            const content = delta["content"] as string | undefined;
            if (content) {
              yield { type: "token", content: sanitizeOutput(content) };
            }
            if (parsed["usage"]) {
              const u = extractUsage(parsed);
              promptTokens = u.promptTokens;
              completionTokens = u.completionTokens;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.config.model, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LlamaCpp embed failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const embeddings = data["data"] as Array<Record<string, unknown>> | undefined;
      const vec = embeddings?.[0]?.["embedding"] as number[] | undefined;
      return { embedding: vec ?? [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OpenAIClient extends LLMClient {
  private clientPromise: Promise<typeof import("openai")>;

  constructor(config: LLMConfig) {
    super(config);
    this.clientPromise = import("openai");
  }

  private async getClient() {
    const mod = await this.clientPromise;
    return new mod.OpenAI({
      apiKey: this.config.apiKey ?? process.env["OPENAI_API_KEY"],
      baseURL: this.config.baseUrl,
      timeout: this.timeout,
    });
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const client = await this.getClient();
    const res = await client.chat.completions.create({
      model: opts?.model ?? this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 4096,
      stop: opts?.stop,
      stream: false,
    });
    const choice = res.choices[0];
    return {
      content: choice?.message?.content ?? "",
      usage: {
        promptTokens: res.usage?.prompt_tokens ?? 0,
        completionTokens: res.usage?.completion_tokens ?? 0,
        totalTokens: res.usage?.total_tokens ?? 0,
      },
    };
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const client = await this.getClient();
    const stream = await client.chat.completions.create({
      model: opts?.model ?? this.config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: opts?.temperature ?? 0.7,
      max_tokens: opts?.maxTokens ?? 4096,
      stop: opts?.stop,
      stream: true,
      stream_options: { include_usage: true },
    });

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const chunk of stream) {
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { type: "token", content: sanitizeOutput(delta) };
      }
    }

    yield { type: "done", usage: { promptTokens, completionTokens } };
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const client = await this.getClient();
    const res = await client.embeddings.create({
      model: this.config.model,
      input: text,
    });
    return { embedding: res.data[0]?.embedding ?? [] };
  }
}

export class OllamaClient extends LLMClient {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
    this.timeout = config.timeout ?? LOCAL_TIMEOUT;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }, 1, 500);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return data.models?.map((m) => m.name) ?? [];
    } catch {
      return [];
    }
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts?.model ?? this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          options: {
            temperature: opts?.temperature ?? 0.7,
            num_predict: opts?.maxTokens ?? 4096,
          },
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama chat failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const msg = (data["message"] ?? {}) as Record<string, unknown>;
      const evalCount = (data["eval_count"] as number) ?? 0;
      const promptEvalCount = (data["prompt_eval_count"] as number) ?? 0;
      return {
        content: sanitizeOutput((msg["content"] as string) ?? ""),
        usage: {
          promptTokens: promptEvalCount,
          completionTokens: evalCount,
          totalTokens: promptEvalCount + evalCount,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: opts?.model ?? this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          options: {
            temperature: opts?.temperature ?? 0.7,
            num_predict: opts?.maxTokens ?? 4096,
          },
          stream: true,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama stream failed (${res.status}): ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const data = JSON.parse(trimmed) as Record<string, unknown>;
              const msg = (data["message"] ?? {}) as Record<string, unknown>;
              const content = msg["content"] as string | undefined;
              if (content) {
                yield { type: "token", content: sanitizeOutput(content) };
              }
              if (data["done"] === true) {
                promptTokens = (data["prompt_eval_count"] as number) ?? 0;
                completionTokens = (data["eval_count"] as number) ?? 0;
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.config.model, prompt: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Ollama embed failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      return { embedding: (data["embedding"] as number[]) ?? [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class TextGenWebUIClient extends LLMClient {
  private baseUrl: string;

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? "http://localhost:5000/v1";
    this.timeout = config.timeout ?? LOCAL_TIMEOUT;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }, 1, 500);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return data.data?.map((m) => m.id) ?? [];
    } catch {
      return [];
    }
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const payload = buildChatPayload(messages, opts, this.config.model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: false }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`TextGenWebUI chat failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const choices = data["choices"] as Array<Record<string, unknown>> | undefined;
      const message = (choices?.[0]?.["message"] ?? {}) as Record<string, unknown>;
      const usage = extractUsage(data);
      return {
        content: sanitizeOutput((message["content"] as string) ?? ""),
        usage: { ...usage, totalTokens: usage.promptTokens + usage.completionTokens },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const payload = buildChatPayload(messages, opts, this.config.model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`TextGenWebUI stream failed (${res.status}): ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseSSELine(trimmed);
            if (!parsed) continue;
            const choices = parsed["choices"] as Array<Record<string, unknown>> | undefined;
            const delta = (choices?.[0]?.["delta"] ?? {}) as Record<string, unknown>;
            const content = delta["content"] as string | undefined;
            if (content) {
              yield { type: "token", content: sanitizeOutput(content) };
            }
            if (parsed["usage"]) {
              const u = extractUsage(parsed);
              promptTokens = u.promptTokens;
              completionTokens = u.completionTokens;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.config.model, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`TextGenWebUI embed failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const embeddings = data["data"] as Array<Record<string, unknown>> | undefined;
      return { embedding: (embeddings?.[0]?.["embedding"] as number[]) ?? [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class LocalAIClient extends LLMClient {
  private baseUrl: string;
  private loadedModels: Set<string> = new Set();

  constructor(config: LLMConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? "http://localhost:8080/v1";
    this.timeout = config.timeout ?? LOCAL_TIMEOUT;
  }

  async probe(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      }, 1, 500);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return data.data?.map((m) => m.id) ?? [];
    } catch {
      return [];
    }
  }

  async loadModel(model: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        this.loadedModels.add(model);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async unloadModel(model: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models/unload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.ok) {
        this.loadedModels.delete(model);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  getLoadedModels(): string[] {
    return Array.from(this.loadedModels);
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const model = opts?.model ?? this.config.model;
    if (!this.loadedModels.has(model)) {
      await this.loadModel(model);
    }
    const payload = buildChatPayload(messages, opts, model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: false }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LocalAI chat failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const choices = data["choices"] as Array<Record<string, unknown>> | undefined;
      const message = (choices?.[0]?.["message"] ?? {}) as Record<string, unknown>;
      const usage = extractUsage(data);
      return {
        content: sanitizeOutput((message["content"] as string) ?? ""),
        usage: { ...usage, totalTokens: usage.promptTokens + usage.completionTokens },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const model = opts?.model ?? this.config.model;
    if (!this.loadedModels.has(model)) {
      await this.loadModel(model);
    }
    const payload = buildChatPayload(messages, opts, model);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LocalAI stream failed (${res.status}): ${body}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseSSELine(trimmed);
            if (!parsed) continue;
            const choices = parsed["choices"] as Array<Record<string, unknown>> | undefined;
            const delta = (choices?.[0]?.["delta"] ?? {}) as Record<string, unknown>;
            const content = delta["content"] as string | undefined;
            if (content) {
              yield { type: "token", content: sanitizeOutput(content) };
            }
            if (parsed["usage"]) {
              const u = extractUsage(parsed);
              promptTokens = u.promptTokens;
              completionTokens = u.completionTokens;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.config.model, input: text }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LocalAI embed failed (${res.status}): ${body}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const embeddings = data["data"] as Array<Record<string, unknown>> | undefined;
      return { embedding: (embeddings?.[0]?.["embedding"] as number[]) ?? [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

export class ReplicateClient extends LLMClient {
  private apiToken: string;

  constructor(config: LLMConfig) {
    super(config);
    this.apiToken = config.apiKey ?? process.env["REPLICATE_API_TOKEN"] ?? "";
    this.timeout = config.timeout ?? 300_000;
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const model = opts?.model ?? this.config.model;
    const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const createRes = await fetchWithRetry("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${this.apiToken}`,
        },
        body: JSON.stringify({
          version: model,
          input: {
            prompt,
            max_tokens: opts?.maxTokens ?? 4096,
            temperature: opts?.temperature ?? 0.7,
          },
        }),
        signal: controller.signal,
      });

      if (!createRes.ok) {
        const body = await createRes.text().catch(() => "");
        throw new Error(`Replicate create failed (${createRes.status}): ${body}`);
      }

      const prediction = (await createRes.json()) as Record<string, unknown>;
      const pollUrl = prediction["urls"] as Record<string, string> | undefined;
      const getUri = pollUrl?.["get"] ?? "";

      let result: Record<string, unknown> = prediction;
      while (result["status"] === "starting" || result["status"] === "processing") {
        await sleep(1000);
        const pollRes = await fetch(getUri, {
          headers: { Authorization: `Token ${this.apiToken}` },
          signal: controller.signal,
        });
        if (!pollRes.ok) break;
        result = (await pollRes.json()) as Record<string, unknown>;
      }

      const output = result["output"] as string | string[] | undefined;
      const text = Array.isArray(output) ? output.join("") : (output ?? "");

      return {
        content: sanitizeOutput(text),
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const result = await this.chat(messages, opts);
    yield { type: "token", content: result.content };
    yield { type: "done", usage: result.usage };
  }

  async embed(_text: string): Promise<EmbeddingResult> {
    throw new Error("Replicate does not support embeddings via this client");
  }
}

export class AnthropicClient extends LLMClient {
  private clientPromise: Promise<typeof import("@anthropic-ai/sdk")>;

  constructor(config: LLMConfig) {
    super(config);
    this.clientPromise = import("@anthropic-ai/sdk");
  }

  private async getClient() {
    const mod = await this.clientPromise;
    return new mod.Anthropic({
      apiKey: this.config.apiKey ?? process.env["ANTHROPIC_API_KEY"],
      baseURL: this.config.baseUrl,
      timeout: this.timeout,
    });
  }

  private toAnthropicMessages(
    messages: ChatMessage[],
  ): { system?: string; messages: Array<{ role: "user" | "assistant"; content: string }> } {
    let system: string | undefined;
    const chatMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = msg.content;
      } else {
        chatMessages.push({ role: msg.role as "user" | "assistant", content: msg.content });
      }
    }

    return { system, messages: chatMessages };
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const client = await this.getClient();
    const { system, messages: chatMessages } = this.toAnthropicMessages(messages);

    const params: Record<string, unknown> = {
      model: opts?.model ?? this.config.model,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: chatMessages,
    };
    if (system) params["system"] = system;
    if (opts?.temperature !== undefined) params["temperature"] = opts.temperature;
    if (opts?.stop) params["stop_sequences"] = opts.stop;

    const res = await client.messages.create(params as never);
    const textBlock = res.content.find((b) => b.type === "text");
    return {
      content: textBlock?.text ?? "",
      usage: {
        promptTokens: res.usage.input_tokens,
        completionTokens: res.usage.output_tokens,
        totalTokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const client = await this.getClient();
    const { system, messages: chatMessages } = this.toAnthropicMessages(messages);

    const params: Record<string, unknown> = {
      model: opts?.model ?? this.config.model,
      max_tokens: opts?.maxTokens ?? 4096,
      messages: chatMessages,
    };
    if (system) params["system"] = system;
    if (opts?.temperature !== undefined) params["temperature"] = opts.temperature;
    if (opts?.stop) params["stop_sequences"] = opts.stop;

    const stream = client.messages.stream(params as never);

    for await (const event of stream) {
      if (event.type === "content_block_delta" && "text" in event.delta) {
        yield { type: "token", content: sanitizeOutput(event.delta.text) };
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "done",
      usage: {
        promptTokens: finalMessage.usage.input_tokens,
        completionTokens: finalMessage.usage.output_tokens,
      },
    };
  }

  async embed(_text: string): Promise<EmbeddingResult> {
    throw new Error("Anthropic does not support embeddings");
  }
}

export class GeminiClient extends LLMClient {
  private apiKey: string;

  constructor(config: LLMConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env["GOOGLE_API_KEY"] ?? "";
    this.baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  private baseUrl: string;

  private toGeminiMessages(
    messages: ChatMessage[],
  ): { systemInstruction?: { parts: Array<{ text: string }> }; contents: Array<{ role: string; parts: Array<{ text: string }> }> } {
    let systemInstruction: { parts: Array<{ text: string }> } | undefined;
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    return { systemInstruction, contents };
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const model = opts?.model ?? this.config.model;
    const { systemInstruction, contents } = this.toGeminiMessages(messages);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: opts?.temperature ?? 0.7,
          maxOutputTokens: opts?.maxTokens ?? 4096,
          ...(opts?.stop ? { stopSequences: opts.stop } : {}),
        },
      };
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const res = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini chat failed (${res.status}): ${text}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const candidates = data["candidates"] as Array<Record<string, unknown>> | undefined;
      const content = (candidates?.[0] as Record<string, unknown>)?.["content"] as Record<string, unknown> | undefined;
      const parts = content?.["parts"] as Array<Record<string, unknown>> | undefined;
      const text = (parts?.[0] as Record<string, unknown>)?.["text"] as string ?? "";
      const usage = data["usageMetadata"] as Record<string, unknown> | undefined;
      return {
        content: text,
        usage: {
          promptTokens: (usage?.["promptTokenCount"] as number) ?? 0,
          completionTokens: (usage?.["candidatesTokenCount"] as number) ?? 0,
          totalTokens: (usage?.["totalTokenCount"] as number) ?? 0,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const model = opts?.model ?? this.config.model;
    const { systemInstruction, contents } = this.toGeminiMessages(messages);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        contents,
        generationConfig: {
          temperature: opts?.temperature ?? 0.7,
          maxOutputTokens: opts?.maxTokens ?? 4096,
          ...(opts?.stop ? { stopSequences: opts.stop } : {}),
        },
      };
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const res = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Gemini stream failed (${res.status}): ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const data = JSON.parse(jsonStr) as Record<string, unknown>;
              const candidates = data["candidates"] as Array<Record<string, unknown>> | undefined;
              const content = (candidates?.[0] as Record<string, unknown>)?.["content"] as Record<string, unknown> | undefined;
              const parts = content?.["parts"] as Array<Record<string, unknown>> | undefined;
              const text = (parts?.[0] as Record<string, unknown>)?.["text"] as string | undefined;
              if (text) yield { type: "token", content: sanitizeOutput(text) };
              const usage = data["usageMetadata"] as Record<string, unknown> | undefined;
              if (usage) {
                promptTokens = (usage["promptTokenCount"] as number) ?? promptTokens;
                completionTokens = (usage["candidatesTokenCount"] as number) ?? completionTokens;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(_text: string): Promise<EmbeddingResult> {
    throw new Error("Gemini does not support embeddings via this client");
  }
}

export class CohereClient extends LLMClient {
  private apiKey: string;

  constructor(config: LLMConfig) {
    super(config);
    this.apiKey = config.apiKey ?? process.env["COHERE_API_KEY"] ?? "";
    this.baseUrl = config.baseUrl ?? "https://api.cohere.ai/v2";
  }

  private baseUrl: string;

  private toCohereMessages(
    messages: ChatMessage[],
  ): { role: string; message: string }[] {
    return messages.map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content,
    }));
  }

  async chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult> {
    const model = opts?.model ?? this.config.model;
    const chatHistory = this.toCohereMessages(messages);
    const lastMessage = chatHistory.pop()?.message ?? "";
    const preamble = messages.find((m) => m.role === "system")?.content;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        model,
        message: lastMessage,
        chat_history: chatHistory,
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
      };
      if (preamble) body.preamble = preamble;
      if (opts?.stop) body.stop_sequences = opts.stop;

      const res = await fetchWithRetry(`${this.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Cohere chat failed (${res.status}): ${text}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const text = (data["text"] as string) ?? "";
      const meta = data["meta"] as Record<string, unknown> | undefined;
      const tokens = meta?.["tokens"] as Record<string, unknown> | undefined;

      return {
        content: text,
        usage: {
          promptTokens: (tokens?.["input_tokens"] as number) ?? 0,
          completionTokens: (tokens?.["output_tokens"] as number) ?? 0,
          totalTokens: ((tokens?.["input_tokens"] as number) ?? 0) + ((tokens?.["output_tokens"] as number) ?? 0),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(
    messages: ChatMessage[],
    opts?: ChatOptions,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    const model = opts?.model ?? this.config.model;
    const chatHistory = this.toCohereMessages(messages);
    const lastMessage = chatHistory.pop()?.message ?? "";
    const preamble = messages.find((m) => m.role === "system")?.content;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const body: Record<string, unknown> = {
        model,
        message: lastMessage,
        chat_history: chatHistory,
        max_tokens: opts?.maxTokens ?? 4096,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      };
      if (preamble) body.preamble = preamble;
      if (opts?.stop) body.stop_sequences = opts.stop;

      const res = await fetchWithRetry(`${this.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Cohere stream failed (${res.status}): ${text}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let lastActivity = Date.now();

      try {
        while (true) {
          if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
            throw new Error("Stream idle timeout - no data received");
          }
          const { done, value } = await readWithTimeout(reader, STREAM_READ_TIMEOUT_MS);
          if (done) break;
          lastActivity = Date.now();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === "[DONE]") continue;
            try {
              const data = JSON.parse(jsonStr) as Record<string, unknown>;
              const eventType = data["event_type"] as string | undefined;
              if (eventType === "content-delta") {
                const delta = data["delta"] as Record<string, unknown> | undefined;
                const message = delta?.["message"] as Record<string, unknown> | undefined;
                const text = message?.["text"] as string | undefined;
                if (text) yield { type: "token", content: sanitizeOutput(text) };
              }
              if (eventType === "stream-end") {
                const meta = data["meta"] as Record<string, unknown> | undefined;
                const tokens = meta?.["tokens"] as Record<string, unknown> | undefined;
                promptTokens = (tokens?.["input_tokens"] as number) ?? 0;
                completionTokens = (tokens?.["output_tokens"] as number) ?? 0;
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      yield { type: "done", usage: { promptTokens, completionTokens } };
    } finally {
      clearTimeout(timer);
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetchWithRetry(`${this.baseUrl}/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          texts: [text],
          input_type: "search_document",
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Cohere embed failed (${res.status}): ${text}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const embeddings = data["embeddings"] as number[][] | undefined;
      return { embedding: embeddings?.[0] ?? [] };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case "llamacpp":
      return new LlamaCppClient(config);
    case "openai":
    case "azure":
    case "groq":
    case "together":
    case "deepseek":
    case "mistral":
    case "perplexity":
    case "fireworks":
    case "openrouter":
    case "xai":
    case "lmstudio":
      return new OpenAIClient(config);
    case "oobabooga":
      return new TextGenWebUIClient(config);
    case "localai":
      return new LocalAIClient(config);
    case "replicate":
      return new ReplicateClient(config);
    case "ollama":
      return new OllamaClient(config);
    case "anthropic":
      return new AnthropicClient(config);
    case "gemini":
      return new GeminiClient(config);
    case "cohere":
      return new CohereClient(config);
    default: {
      const _never: never = config.provider;
      throw new Error(`Unknown LLM provider: ${_never}`);
    }
  }
}
