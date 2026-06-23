import { join } from 'path';
import { KairosConfigSchema, type KairosConfigOutput } from './schema.js';
import { DEFAULT_CONFIG, getDefaultConfigPath, getProjectConfigPath, getKairosDir } from './defaults.js';

type KairosConfig = KairosConfigOutput;

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key of Object.keys(source) as Array<keyof T>) {
    const targetValue = result[key];
    const sourceValue = source[key];
    
    if (sourceValue === undefined) continue;
    
    if (
      typeof targetValue === 'object' && targetValue !== null &&
      typeof sourceValue === 'object' && sourceValue !== null &&
      !Array.isArray(targetValue) && !Array.isArray(sourceValue)
    ) {
      (result[key] as Record<string, unknown>) = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      result[key] = sourceValue as T[keyof T];
    }
  }
  
  return result;
}

function applyEnvVars(config: KairosConfig): KairosConfig {
  const result = { ...config };
  
  const provider = process.env.KAIROS_LLM_PROVIDER;
  const validProviders = ['llamacpp', 'openai', 'anthropic', 'ollama', 'gemini', 'azure', 'groq', 'together', 'deepseek', 'mistral', 'perplexity', 'fireworks', 'openrouter', 'xai', 'cohere', 'replicate', 'lmstudio', 'oobabooga', 'localai'] as const;
  if (provider && (validProviders as readonly string[]).includes(provider)) {
    const providerKey = provider as typeof validProviders[number];
    const defaults = PROVIDER_DEFAULTS[providerKey];
    if (defaults) {
      result.llm = { ...result.llm, provider: providerKey, baseUrl: defaults.baseUrl };
    } else {
      result.llm = { ...result.llm, provider: providerKey };
    }
  }
  
  const model = process.env.KAIROS_LLM_MODEL;
  if (model) {
    result.llm = { ...result.llm, model };
  }
  
  const baseUrl = process.env.KAIROS_LLM_BASE_URL;
  if (baseUrl) {
    result.llm = { ...result.llm, baseUrl };
  }
  
  const apiKey = process.env.KAIROS_LLM_API_KEY;
  if (apiKey) {
    result.llm = { ...result.llm, apiKey };
  }
  
  const maxTokens = process.env.KAIROS_LLM_MAX_TOKENS;
  if (maxTokens) {
    const parsed = parseInt(maxTokens, 10);
    if (!isNaN(parsed) && parsed > 0) {
      result.llm = { ...result.llm, maxTokens: parsed };
    }
  }
  
  const temperature = process.env.KAIROS_LLM_TEMPERATURE;
  if (temperature) {
    const parsed = parseFloat(temperature);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
      result.llm = { ...result.llm, temperature: parsed };
    }
  }
  
  const safetyEnabled = process.env.KAIROS_SAFETY_ENABLED;
  if (safetyEnabled !== undefined) {
    result.safety = { ...result.safety, enabled: safetyEnabled === 'true' };
  }
  
  const autoApprove = process.env.KAIROS_SAFETY_AUTO_APPROVE;
  if (autoApprove !== undefined) {
    result.safety = { ...result.safety, autoApprove: autoApprove === 'true' };
  }
  
  const daemonEnabled = process.env.KAIROS_DAEMON_ENABLED;
  if (daemonEnabled !== undefined) {
    result.daemon = { ...result.daemon, enabled: daemonEnabled === 'true' };
  }
  
  const daemonPort = process.env.KAIROS_DAEMON_PORT;
  if (daemonPort) {
    const parsed = parseInt(daemonPort, 10);
    if (!isNaN(parsed) && parsed >= 1024 && parsed <= 65535) {
      result.daemon = { ...result.daemon, port: parsed };
    }
  }

  const braveApiKey = process.env.BRAVE_API_KEY;
  if (braveApiKey) {
    result.webSearch = { ...result.webSearch, braveApiKey };
  }

  const mimoApiKey = process.env.MIMO_API_KEY;
  if (mimoApiKey) {
    result.webSearch = { ...result.webSearch, mimoApiKey };
  }

  const exaApiKey = process.env.EXA_API_KEY;
  if (exaApiKey) {
    result.webSearch = { ...result.webSearch, exaApiKey };
  }

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken) {
    result.telegram = { ...result.telegram, enabled: true, token: telegramToken };
  }

  const telegramUsers = process.env.TELEGRAM_ALLOWED_USERS;
  if (telegramUsers) {
    const ids = telegramUsers.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length > 0) result.telegram = { ...result.telegram, allowedUserIds: ids };
  }

  const telegramChats = process.env.TELEGRAM_ALLOWED_CHATS;
  if (telegramChats) {
    const ids = telegramChats.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length > 0) result.telegram = { ...result.telegram, allowedChats: ids };
  }

  const telegramWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (telegramWebhookUrl) {
    result.telegram = { ...result.telegram, webhookUrl: telegramWebhookUrl };
  }

  const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (telegramWebhookSecret) {
    result.telegram = { ...result.telegram, webhookSecret: telegramWebhookSecret };
  }

  const telegramHomeChannel = process.env.TELEGRAM_HOME_CHANNEL;
  if (telegramHomeChannel) {
    const id = Number(telegramHomeChannel);
    if (!isNaN(id)) result.telegram = { ...result.telegram, homeChannel: id };
  }

  return result;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  llamacpp: { baseUrl: 'http://localhost:8080', model: 'local' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-pro' },
  azure: { baseUrl: '', model: 'gpt-4o' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama3-70b-8192' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3-70b-chat-hf' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest' },
  perplexity: { baseUrl: 'https://api.perplexity.ai', model: 'llama-3-sonar-large-32k-online' },
  fireworks: { baseUrl: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/llama-v3p1-70b-instruct' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3-70b-instruct' },
  xai: { baseUrl: 'https://api.x.ai/v1', model: 'grok-beta' },
  cohere: { baseUrl: 'https://api.cohere.ai/v2', model: 'command-r-plus' },
  replicate: { baseUrl: 'https://api.replicate.com/v1', model: 'meta/meta-llama-3-70b-instruct' },
  lmstudio: { baseUrl: 'http://localhost:1234/v1', model: 'local' },
  oobabooga: { baseUrl: 'http://localhost:5000/v1', model: 'local' },
  localai: { baseUrl: 'http://localhost:8080/v1', model: 'local' },
};

function applyCliFlags(config: KairosConfig, cliArgs: Record<string, string>): KairosConfig {
  const result = { ...config };
  
  const validProviders = ['llamacpp', 'openai', 'anthropic', 'ollama', 'gemini', 'azure', 'groq', 'together', 'deepseek', 'mistral', 'perplexity', 'fireworks', 'openrouter', 'xai', 'cohere', 'replicate', 'lmstudio', 'oobabooga', 'localai'] as const;
  if (cliArgs.provider && (validProviders as readonly string[]).includes(cliArgs.provider)) {
    const provider = cliArgs.provider as typeof validProviders[number];
    const defaults = PROVIDER_DEFAULTS[provider];
    if (defaults) {
      result.llm = { ...result.llm, provider, baseUrl: defaults.baseUrl };
    } else {
      result.llm = { ...result.llm, provider };
    }
  }
  
  if (cliArgs.model) {
    result.llm = { ...result.llm, model: cliArgs.model };
  }
  
  if (cliArgs.baseUrl) {
    result.llm = { ...result.llm, baseUrl: cliArgs.baseUrl };
  }
  
  if (cliArgs.apiKey) {
    result.llm = { ...result.llm, apiKey: cliArgs.apiKey };
  }
  
  if (cliArgs.maxTokens) {
    const parsed = parseInt(cliArgs.maxTokens, 10);
    if (!isNaN(parsed) && parsed > 0) {
      result.llm = { ...result.llm, maxTokens: parsed };
    }
  }
  
  if (cliArgs.temperature) {
    const parsed = parseFloat(cliArgs.temperature);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 2) {
      result.llm = { ...result.llm, temperature: parsed };
    }
  }
  
  if (cliArgs.safety !== undefined) {
    result.safety = { ...result.safety, enabled: cliArgs.safety === 'true' };
  }
  
  if (cliArgs.autoApprove !== undefined) {
    result.safety = { ...result.safety, autoApprove: cliArgs.autoApprove === 'true' };
  }
  
  if (cliArgs.daemon !== undefined) {
    result.daemon = { ...result.daemon, enabled: cliArgs.daemon === 'true' };
  }
  
  if (cliArgs.daemonPort) {
    const parsed = parseInt(cliArgs.daemonPort, 10);
    if (!isNaN(parsed) && parsed >= 1024 && parsed <= 65535) {
      result.daemon = { ...result.daemon, port: parsed };
    }
  }
  
  if (cliArgs.theme) {
    result.tui = { ...result.tui, theme: cliArgs.theme as 'default' | 'dark' | 'light' | 'monokai' | 'dracula' };
  }
  
  return result;
}

async function readJsonFile(path: string): Promise<Record<string, unknown> | null> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content) as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await Bun.write(join(dir, '.gitkeep'), '');
  } catch {
    // Directory might already exist or we don't have permissions
  }
}

export async function loadConfig(cliArgs?: Record<string, string>): Promise<KairosConfig> {
  let config = { ...DEFAULT_CONFIG };
  
  await Promise.all([
    ensureDir(config.paths.config),
    ensureDir(config.paths.data),
    ensureDir(config.paths.cache),
    ensureDir(config.paths.logs),
    ensureDir(config.paths.sessions),
    ensureDir(config.paths.memory),
    ensureDir(config.paths.extensions),
  ]);
  
  const [globalConfig, projectConfig] = await Promise.all([
    readJsonFile(getDefaultConfigPath()),
    readJsonFile(getProjectConfigPath()),
  ]);
  
  if (globalConfig) {
    config = deepMerge(config, globalConfig);
  }
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }
  
  config = applyEnvVars(config);
  
  if (cliArgs) {
    config = applyCliFlags(config, cliArgs);
  }
  
  const validated = KairosConfigSchema.safeParse(config);
  if (validated.success) {
    return validated.data;
  }
  
  console.error('Config validation failed:', validated.error.format());
  return config;
}

export async function saveConfig(config: KairosConfig): Promise<void> {
  const configPath = getDefaultConfigPath();
  const dir = getKairosDir();
  await ensureDir(dir);
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

export async function resetConfig(): Promise<KairosConfig> {
  const configPath = getDefaultConfigPath();
  const dir = getKairosDir();
  await ensureDir(dir);
  await Bun.write(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return DEFAULT_CONFIG;
}

export { KairosConfigSchema };
export type { KairosConfig };
