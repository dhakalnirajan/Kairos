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
  if (provider && ['llamacpp', 'openai', 'anthropic', 'ollama'].includes(provider)) {
    const providerKey = provider as 'llamacpp' | 'openai' | 'anthropic' | 'ollama';
    const defaults = PROVIDER_DEFAULTS[providerKey]!;
    result.llm = { ...result.llm, provider: providerKey, baseUrl: defaults.baseUrl };
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
  
  return result;
}

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; model: string }> = {
  llamacpp: { baseUrl: 'http://localhost:8080', model: 'local' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
};

function applyCliFlags(config: KairosConfig, cliArgs: Record<string, string>): KairosConfig {
  const result = { ...config };
  
  if (cliArgs.provider && ['llamacpp', 'openai', 'anthropic', 'ollama'].includes(cliArgs.provider)) {
    const provider = cliArgs.provider as 'llamacpp' | 'openai' | 'anthropic' | 'ollama';
    const defaults = PROVIDER_DEFAULTS[provider]!;
    result.llm = { ...result.llm, provider, baseUrl: defaults.baseUrl };
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
