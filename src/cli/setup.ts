import { loadConfig, saveConfig } from '../config/index.ts';
import { getDefaultConfigPath, getKairosDir } from '../config/defaults.ts';
import { createLLMClient } from '../llm/client.ts';
import type { LLMProvider } from '../types/index.ts';

export async function runSetup(): Promise<void> {
  console.log('\x1b[36m╔══════════════════════════════════════╗');
  console.log('║       KAIROS CODE - Setup Wizard     ║');
  console.log('╚══════════════════════════════════════╝\x1b[0m\n');

  const config = await loadConfig();

  console.log('\x1b[33mStep 1: LLM Provider\x1b[0m');
  console.log('Available providers: llamacpp, openai, ollama, anthropic');
  console.log(`Current: ${config.llm.provider}`);
  console.log('');

  const provider = await promptUser('Provider', config.llm.provider) as LLMProvider;
  const model = await promptUser('Model', config.llm.model);
  const baseUrl = await promptUser('Base URL', config.llm.baseUrl ?? '');
  const apiKey = await promptUser('API Key (leave empty to skip)', config.llm.apiKey ?? '');

  console.log('\n\x1b[33mStep 2: Probing providers...\x1b[0m');

  const isCloudProvider = ['openai', 'anthropic', 'gemini', 'groq'].includes(provider);

  if (isCloudProvider && !apiKey) {
    console.log(`\x1b[33m⚠ Skipping probe — ${provider} requires an API key\x1b[0m`);
    console.log('Continuing with configuration...\n');
  } else {
    const probeConfig = {
      ...config.llm,
      provider,
      model,
      baseUrl: baseUrl || config.llm.baseUrl,
      apiKey: apiKey || config.llm.apiKey,
    };

    try {
      const client = createLLMClient(probeConfig);
      const result = await client.chat([{ role: 'user', content: 'Say "ok" in one word.' }], { maxTokens: 10 });
      console.log(`\x1b[32m✓ Provider responded: "${result.content.trim()}"\x1b[0m`);
    } catch (e) {
      console.log(`\x1b[31m✗ Provider probe failed: ${e}\x1b[0m`);
      console.log('Continuing with configuration...\n');
    }
  }

  const updatedConfig = {
    ...config,
    llm: {
      ...config.llm,
      provider,
      model,
      baseUrl: baseUrl || config.llm.baseUrl,
      apiKey: apiKey || config.llm.apiKey,
    },
  };

  await saveConfig(updatedConfig as never);
  console.log(`\n\x1b[32m✓ Configuration saved to ${getDefaultConfigPath()}\x1b[0m`);

  console.log('\n\x1b[36mSetup complete! Run `bun run dev` to start.\x1b[0m\n');
}

async function promptUser(label: string, defaultValue: string): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline') as typeof import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${label} [${defaultValue}]: `, (answer: string) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}
