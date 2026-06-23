import { z } from 'zod';

export const LLMConfigSchema = z.object({
  provider: z.enum(['llamacpp', 'openai', 'anthropic', 'ollama', 'gemini', 'azure', 'groq', 'together', 'deepseek', 'mistral', 'perplexity', 'fireworks', 'openrouter', 'xai', 'cohere', 'replicate', 'lmstudio', 'oobabooga', 'localai']).default('anthropic'),
  model: z.string().min(1).default('claude-sonnet-4-20250514'),
  baseUrl: z.string().default('https://api.anthropic.com/v1'),
  apiKey: z.string().optional(),
  maxTokens: z.number().int().positive().default(8192),
  temperature: z.number().min(0).max(2).default(0.7),
  fallbackEnabled: z.boolean().default(true),
  autoDiscoverLocal: z.boolean().default(true),
});

export const ToolsConfigSchema = z.object({
  enabled: z.array(z.string()).default(['read', 'write', 'edit', 'bash', 'glob', 'grep']),
  disabled: z.array(z.string()).default([]),
  custom: z.array(z.string()).default([]),
  confirmBeforeExecute: z.boolean().default(true),
  maxConcurrent: z.number().int().positive().default(4),
});

export const SafetyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowedRiskLevels: z.array(z.enum(['read', 'write', 'execute', 'network'])).default(['read', 'write', 'execute']),
  blockedCommands: z.array(z.string()).default(['rm -rf /', 'format', 'del /s /q']),
  blockedPaths: z.array(z.string()).default(['/etc', '/System', '/Windows/System32']),
  autoApprove: z.boolean().default(false),
  requireConfirmationFor: z.array(z.string()).default(['bash', 'write', 'edit']),
});

export const TUIConfigSchema = z.object({
  theme: z.enum(['default', 'dark', 'light', 'monokai', 'dracula']).default('default'),
  showTimestamps: z.boolean().default(true),
  showTokenCount: z.boolean().default(true),
  showCost: z.boolean().default(false),
  compactMode: z.boolean().default(false),
  useColors: z.boolean().default(true),
});

export const MemoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  persistToDisk: z.boolean().default(true),
  maxSessionSize: z.number().int().positive().default(1048576),
  compressThreshold: z.number().int().positive().default(524288),
  ttlDays: z.number().int().positive().default(30),
});

export const DaemonConfigSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(1024).max(65535).default(7777),
  maxWorkers: z.number().int().positive().default(4),
  taskTimeout: z.number().int().positive().default(300000),
  heartbeatInterval: z.number().int().positive().default(5000),
  pidFile: z.string().default(''),
  logFile: z.string().default(''),
});

export const HooksConfigSchema = z.object({
  enabled: z.boolean().default(false),
  preTool: z.array(z.string()).default([]),
  postTool: z.array(z.string()).default([]),
  preTurn: z.array(z.string()).default([]),
  postTurn: z.array(z.string()).default([]),
  onError: z.array(z.string()).default([]),
});

export const ExtensionsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoDiscover: z.boolean().default(true),
  searchPaths: z.array(z.string()).default([]),
  loaded: z.array(z.string()).default([]),
  disabled: z.array(z.string()).default([]),
});

export const WebSearchConfigSchema = z.object({
  provider: z.enum(['brave', 'duckduckgo', 'mimo', 'exa']).default('brave'),
  braveApiKey: z.string().optional(),
  mimoApiKey: z.string().optional(),
  mimoBaseUrl: z.string().default('https://api.xiaomimimo.com/v1'),
  mimoModel: z.string().default('mimo-v2.5'),
  exaApiKey: z.string().optional(),
  searchType: z.enum(['auto', 'fast', 'deep']).optional(),
  livecrawl: z.enum(['fallback', 'preferred']).optional(),
  contextMaxCharacters: z.number().optional(),
  maxResults: z.number().int().min(1).max(20).default(5),
  fetchContent: z.boolean().default(false),
  fetchTimeout: z.number().int().positive().default(10000),
  maxContentLength: z.number().int().positive().default(8000),
});

export const PathsConfigSchema = z.object({
  home: z.string().default(''),
  config: z.string().default(''),
  data: z.string().default(''),
  cache: z.string().default(''),
  logs: z.string().default(''),
  sessions: z.string().default(''),
  memory: z.string().default(''),
  extensions: z.string().default(''),
});

export const TelegramConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().optional(),
  allowedUserIds: z.array(z.number()).optional(),
  allowedChats: z.array(z.number()).optional(),
  requireMention: z.boolean().default(false),
  mentionPatterns: z.array(z.string()).default([]),
  streaming: z.boolean().default(true),
  webhookUrl: z.string().optional(),
  webhookSecret: z.string().optional(),
  webhookPort: z.number().int().min(1024).max(65535).default(8443),
  homeChannel: z.number().optional(),
});

export const KairosConfigSchema = z.object({
  version: z.string().default('0.1.1'),
  llm: LLMConfigSchema.default({}),
  tools: ToolsConfigSchema.default({}),
  safety: SafetyConfigSchema.default({}),
  tui: TUIConfigSchema.default({}),
  memory: MemoryConfigSchema.default({}),
  daemon: DaemonConfigSchema.default({}),
  hooks: HooksConfigSchema.default({}),
  extensions: ExtensionsConfigSchema.default({}),
  paths: PathsConfigSchema.default({}),
  webSearch: WebSearchConfigSchema.default({}),
  telegram: TelegramConfigSchema.default({}),
});

export type KairosConfig = z.infer<typeof KairosConfigSchema>;
export type KairosConfigInput = z.input<typeof KairosConfigSchema>;
export type KairosConfigOutput = z.output<typeof KairosConfigSchema>;

export function validateConfig(data: unknown): KairosConfigOutput {
  return KairosConfigSchema.parse(data);
}

export function safeValidateConfig(data: unknown) {
  return KairosConfigSchema.safeParse(data);
}
