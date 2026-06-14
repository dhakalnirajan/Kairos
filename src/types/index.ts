export type LLMProvider =
  | "llamacpp"
  | "openai"
  | "ollama"
  | "anthropic"
  | "gemini"
  | "azure"
  | "groq"
  | "together"
  | "deepseek"
  | "mistral"
  | "perplexity"
  | "fireworks"
  | "openrouter"
  | "xai"
  | "cohere"
  | "replicate"
  | "lmstudio"
  | "oobabooga"
  | "localai";

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stop?: string[];
}

export interface ChatResult {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  type: "token";
  content: string;
}

export interface StreamDone {
  type: "done";
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export type StreamEvent = StreamChunk | StreamDone;

export interface EmbeddingResult {
  embedding: number[];
}
