export type AuthMethod = 'api-key' | 'bearer' | 'none' | 'azure-ad' | 'oauth2';
export type ApiFormat = 'openai-compatible' | 'anthropic-native' | 'google-native' | 'cohere-native';

export interface ProviderDefinition {
  name: string;
  displayName: string;
  baseUrl: string;
  auth: AuthMethod;
  format: ApiFormat;
  envKey?: string;
  envSecret?: string;
  isLocal: boolean;
  defaultModel: string;
  models?: string[];
  headers?: Record<string, string>;
  requiresModel?: boolean;
}

export interface GGUFMetadata {
  architecture?: string;
  contextLength?: number;
  embeddingLength?: number;
  quantization?: string;
  fileSize?: number;
  parameters?: string;
}

export async function extractGGUFMetadata(filePath: string): Promise<GGUFMetadata> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return {};

  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);

  if (view.getUint32(0, true) !== 0x46554747) {
    return {};
  }

  const metadata: GGUFMetadata = {};
  let offset = 4;

  try {
    const version = view.getUint32(offset, true);
    offset += 4;

    const tensorCount = Number(view.getBigUint64(offset, true));
    offset += 8;

    const metadataKVCount = Number(view.getBigUint64(offset, true));
    offset += 8;

    for (let i = 0; i < Math.min(metadataKVCount, 50); i++) {
      const keyLen = view.getUint32(offset, true);
      offset += 4;
      const keyBytes = new Uint8Array(buffer, offset, keyLen);
      const key = new TextDecoder().decode(keyBytes);
      offset += keyLen;

      const valueType = view.getUint32(offset, true);
      offset += 4;

      switch (valueType) {
        case 1: {
          const uint8 = view.getUint8(offset);
          offset += 1;
          if (key === 'general.architecture') {
            const strLen = view.getUint32(offset, true);
            offset += 4;
            const strBytes = new Uint8Array(buffer, offset, strLen);
            metadata.architecture = new TextDecoder().decode(strBytes);
            offset += strLen;
          } else {
            offset += 1;
          }
          break;
        }
        case 2: {
          const int8 = view.getInt8(offset);
          offset += 1;
          break;
        }
        case 3: {
          const uint16 = view.getUint16(offset, true);
          offset += 2;
          break;
        }
        case 4: {
          const int16 = view.getInt16(offset, true);
          offset += 2;
          break;
        }
        case 5: {
          const uint32 = view.getUint32(offset, true);
          offset += 4;
          if (key.endsWith('.context_length') || key.endsWith('.ctx_length')) {
            metadata.contextLength = uint32;
          }
          break;
        }
        case 6: {
          const int32 = view.getInt32(offset, true);
          offset += 4;
          break;
        }
        case 7: {
          const float32 = view.getFloat32(offset, true);
          offset += 4;
          break;
        }
        case 8: {
          const bool = view.getUint8(offset) !== 0;
          offset += 1;
          break;
        }
        case 9: {
          const strLen = view.getUint32(offset, true);
          offset += 4;
          const strBytes = new Uint8Array(buffer, offset, strLen);
          const str = new TextDecoder().decode(strBytes);
          offset += strLen;
          if (key === 'general.architecture') metadata.architecture = str;
          if (key === 'general.quantization') metadata.quantization = str;
          if (key === 'general.name') metadata.parameters = str;
          break;
        }
        default: {
          return metadata;
        }
      }
    }
  } catch {
    // Partial metadata is fine
  }

  metadata.fileSize = buffer.byteLength;
  return metadata;
}

export const LOCAL_PROVIDERS: ProviderDefinition[] = [
  {
    name: 'llamacpp',
    displayName: 'llama.cpp',
    baseUrl: 'http://localhost:8080',
    auth: 'none',
    format: 'openai-compatible',
    isLocal: true,
    defaultModel: 'local',
  },
  {
    name: 'ollama',
    displayName: 'Ollama',
    baseUrl: 'http://localhost:11434',
    auth: 'none',
    format: 'openai-compatible',
    isLocal: true,
    defaultModel: 'llama3',
  },
  {
    name: 'lmstudio',
    displayName: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    auth: 'none',
    format: 'openai-compatible',
    isLocal: true,
    defaultModel: 'local',
  },
  {
    name: 'oobabooga',
    displayName: 'Text Generation WebUI',
    baseUrl: 'http://localhost:5000/v1',
    auth: 'none',
    format: 'openai-compatible',
    isLocal: true,
    defaultModel: 'local',
  },
  {
    name: 'localai',
    displayName: 'LocalAI',
    baseUrl: 'http://localhost:8080/v1',
    auth: 'none',
    format: 'openai-compatible',
    isLocal: true,
    defaultModel: 'local',
  },
];

export const CLOUD_PROVIDERS: ProviderDefinition[] = [
  {
    name: 'openai',
    displayName: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'OPENAI_API_KEY',
    isLocal: false,
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    auth: 'api-key',
    format: 'anthropic-native',
    envKey: 'ANTHROPIC_API_KEY',
    isLocal: false,
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: 'api-key',
    format: 'google-native',
    envKey: 'GOOGLE_API_KEY',
    isLocal: false,
    defaultModel: 'gemini-1.5-pro',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  },
  {
    name: 'azure',
    displayName: 'Azure OpenAI',
    baseUrl: '',
    auth: 'azure-ad',
    format: 'openai-compatible',
    envKey: 'AZURE_OPENAI_API_KEY',
    envSecret: 'AZURE_OPENAI_ENDPOINT',
    isLocal: false,
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-35-turbo'],
  },
  {
    name: 'groq',
    displayName: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'GROQ_API_KEY',
    isLocal: false,
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  {
    name: 'together',
    displayName: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'TOGETHER_API_KEY',
    isLocal: false,
    defaultModel: 'meta-llama/Llama-3-70b-chat-hf',
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'DEEPSEEK_API_KEY',
    isLocal: false,
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  },
  {
    name: 'mistral',
    displayName: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'MISTRAL_API_KEY',
    isLocal: false,
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest'],
  },
  {
    name: 'perplexity',
    displayName: 'Perplexity AI',
    baseUrl: 'https://api.perplexity.ai',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'PERPLEXITY_API_KEY',
    isLocal: false,
    defaultModel: 'llama-3.1-sonar-large-128k-online',
  },
  {
    name: 'fireworks',
    displayName: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'FIREWORKS_API_KEY',
    isLocal: false,
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'OPENROUTER_API_KEY',
    isLocal: false,
    defaultModel: 'anthropic/claude-3.5-sonnet',
  },
  {
    name: 'xai',
    displayName: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'XAI_API_KEY',
    isLocal: false,
    defaultModel: 'grok-2',
    models: ['grok-2', 'grok-2-mini'],
  },
  {
    name: 'cohere',
    displayName: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v2',
    auth: 'api-key',
    format: 'cohere-native',
    envKey: 'COHERE_API_KEY',
    isLocal: false,
    defaultModel: 'command-r-plus',
    models: ['command-r-plus', 'command-r', 'command-light', 'command-r-plus-08-2024', 'command-r-08-2024'],
  },
  {
    name: 'replicate',
    displayName: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    auth: 'api-key',
    format: 'openai-compatible',
    envKey: 'REPLICATE_API_TOKEN',
    isLocal: false,
    defaultModel: 'meta/meta-llama-3-70b-instruct',
    requiresModel: true,
  },
];

export const ALL_PROVIDERS = [...LOCAL_PROVIDERS, ...CLOUD_PROVIDERS];

export function getProviderByName(name: string): ProviderDefinition | undefined {
  return ALL_PROVIDERS.find((p) => p.name === name);
}

export function getProvidersByFormat(format: ApiFormat): ProviderDefinition[] {
  return ALL_PROVIDERS.filter((p) => p.format === format);
}

export function isOpenAICompatible(provider: ProviderDefinition): boolean {
  return provider.format === 'openai-compatible';
}
