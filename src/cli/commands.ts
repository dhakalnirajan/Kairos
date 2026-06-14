import { parseArgs, getFlag, hasFlag } from './parser.ts';
import { loadConfig } from '../config/index.ts';
import { LLMProviderManager } from '../llm/manager.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { registerAllBuiltinTools } from '../tools/builtin/index.ts';
import { MemoryDatabase } from '../memory/database.ts';
import { AgentLoop } from '../agent/loop.ts';
import { getDbPath } from '../utils/paths.ts';
import { logger } from '../utils/logger.ts';
import type { AgentMode } from '../types/tools.ts';

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printUsage();
    return;
  }

  if (hasFlag(args, 'version')) {
    console.log('kairos-code v0.1.0');
    return;
  }

  switch (args.subcommand) {
    case 'setup': {
      const { runSetup } = await import('./setup.ts');
      await runSetup();
      return;
    }

    case 'daemon':
      await startDaemon(args);
      return;

    case 'web':
      await startWebMode(args);
      return;

    case 'auth':
      await handleAuth(args);
      return;

    case 'session':
      await handleSession(args);
      return;

    case 'provider':
      await handleProvider(args);
      return;
  }

  if (hasFlag(args, 'web')) {
    await startWebMode(args);
    return;
  }

  if (hasFlag(args, 'daemon')) {
    await startDaemon(args);
    return;
  }

  const headlessQuery = getFlag(args, 'p') ?? getFlag(args, 'prompt');
  if (headlessQuery) {
    await runHeadless(headlessQuery, args);
    return;
  }

  await runInteractive(args);
}

async function runHeadless(query: string, args: ReturnType<typeof parseArgs>): Promise<void> {
  let input = query;

  if (input === '-' || (!input && !process.stdin.isTTY)) {
    input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    input = input.trim();
  }

  if (!input) {
    console.error('Error: No input provided. Use -p "query" or pipe input via stdin.');
    process.exit(2);
  }

  const config = await loadConfig(args.flags as Record<string, string>);
  const providerName = getFlag(args, 'provider') ?? config.llm.provider;
  const manager = new LLMProviderManager({
    preferredProvider: providerName,
    fallbackEnabled: config.llm.fallbackEnabled,
    autoDiscoverLocal: config.llm.autoDiscoverLocal,
    apiKey: config.llm.apiKey,
  });
  const llm = manager.getActiveClient();
  const tools = new ToolRegistry();
  await registerAllBuiltinTools(tools);
  const memory = new MemoryDatabase(getDbPath());

  const mode: AgentMode = hasFlag(args, 'compose') ? 'NORMAL' : (getFlag(args, 'mode') as AgentMode) ?? 'HEADLESS';

  const agent = new AgentLoop(llm, tools, memory, config, {
    mode,
    workspaceRoot: process.cwd(),
    sessionId: `cli-${Date.now()}`,
  });

  try {
    const response = await agent.run(input);
    console.log(response.response);
    memory.close();
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error}`);
    memory.close();
    process.exit(1);
  }
}

async function runInteractive(args: ReturnType<typeof parseArgs>): Promise<void> {
  const config = await loadConfig(args.flags as Record<string, string>);

  if (hasFlag(args, 'i')) {
    console.log('Interactive mode not yet implemented. Use `kairos dev` for TUI.');
    return;
  }

  const { TUI } = await import('../tui/index.ts');
  const tui = new TUI(config);
  const providerName = getFlag(args, 'provider') ?? config.llm.provider;
  const manager = new LLMProviderManager({
    preferredProvider: providerName,
    fallbackEnabled: config.llm.fallbackEnabled,
    autoDiscoverLocal: config.llm.autoDiscoverLocal,
    apiKey: config.llm.apiKey,
  });
  const llm = manager.getActiveClient();
  const tools = new ToolRegistry();
  await registerAllBuiltinTools(tools);
  const memory = new MemoryDatabase(getDbPath());

  const mode: AgentMode = getFlag(args, 'mode') as AgentMode ?? 'NORMAL';

  const agent = new AgentLoop(llm, tools, memory, config, {
    mode,
    workspaceRoot: process.cwd(),
    sessionId: `tui-${Date.now()}`,
  });

  await tui.start();

  tui.onInput(async (text) => {
    tui.appendMessage('user', text);

    try {
      const stream = agent.stream(text);
      let currentToken = '';

      for await (const event of stream) {
        if (event.type === 'token') {
          currentToken += event.content;
          tui.getStreamRenderer().appendToken(event.content);
        }
        if ('name' in event && event.type === 'tool_call') {
          tui.getStreamRenderer().appendToolCall(event.name, JSON.stringify(event.result));
        }
      }

      tui.getStreamRenderer().flush();
      tui.appendMessage('assistant', currentToken);
    } catch (e) {
      tui.appendMessage('error', `Error: ${e}`);
    }
  });

  tui.updateStatus({ mode, model: config.llm.model, tokens: 0, cost: 0 });
}

async function startDaemon(args: ReturnType<typeof parseArgs>): Promise<void> {
  const { runDaemon } = await import('../daemon/index.ts');
  await runDaemon(args);
}

async function startWebMode(args: ReturnType<typeof parseArgs>): Promise<void> {
  const { startWebServer } = await import('../web/server.ts');
  const config = await loadConfig(args.flags as Record<string, string>);
  const port = Number(getFlag(args, 'port') ?? '3333');
  const host = String(getFlag(args, 'host') ?? '0.0.0.0');
  await startWebServer(config, { port, host });
}

async function handleAuth(args: ReturnType<typeof parseArgs>): Promise<void> {
  const action = args.positional[0];
  console.log(`Auth ${action} - not yet implemented`);
}

async function handleSession(args: ReturnType<typeof parseArgs>): Promise<void> {
  const action = args.positional[0];
  if (action === 'list') {
    const memory = new MemoryDatabase(getDbPath());
    const sessions = memory.getAllSessions();
    if (sessions.length === 0) {
      console.log('No sessions found.');
    } else {
      for (const s of sessions) {
        console.log(`${s.id}  ${s.title}  ${s.model}  ${s.updatedAt}`);
      }
    }
    memory.close();
  } else {
    console.log(`Session ${action} - not yet implemented`);
  }
}

async function handleProvider(args: ReturnType<typeof parseArgs>): Promise<void> {
  const action = args.positional[0] ?? 'list';

  if (action === 'list') {
    const manager = new LLMProviderManager();
    const providers = manager.listProviders();

    console.log('\nAvailable Providers:\n');
    console.log('  LOCAL:');
    for (const p of providers.filter((p) => p.isLocal)) {
      const status = p.available === true ? '\x1b[32m[online]\x1b[0m' :
                     p.available === false ? '\x1b[31m[offline]\x1b[0m' :
                     '\x1b[33m[unknown]\x1b[0m';
      console.log(`    ${p.displayName.padEnd(25)} ${status}`);
    }

    console.log('\n  CLOUD:');
    for (const p of providers.filter((p) => !p.isLocal)) {
      const hasKey = p.envKey ? !!process.env[p.envKey] : false;
      const status = hasKey ? '\x1b[32m[key set]\x1b[0m' : '\x1b[31m[no key]\x1b[0m';
      console.log(`    ${p.displayName.padEnd(25)} ${status}`);
    }
    console.log('');
    return;
  }

  if (action === 'test') {
    const providerName = args.positional[1];
    if (!providerName) {
      console.log('Usage: kairos provider test <provider-name>');
      return;
    }

    const manager = new LLMProviderManager({ preferredProvider: providerName });
    console.log(`\nTesting ${providerName}...`);

    const status = await manager.validateConnection();
    if (status.available) {
      console.log(`\x1b[32m✓ ${status.provider} is available\x1b[0m`);
    } else {
      console.log(`\x1b[31m✗ ${status.provider} is not available: ${status.error}\x1b[0m`);
    }
    console.log('');
    return;
  }

  if (action === 'discover') {
    const manager = new LLMProviderManager({ autoDiscoverLocal: true });
    console.log('\nDiscovering local providers...\n');

    const results = await manager.discoverLocal();
    for (const r of results) {
      const status = r.available ? '\x1b[32m[found]\x1b[0m' : '\x1b[31m[not found]\x1b[0m';
      const latency = r.latencyMs ? ` (${r.latencyMs}ms)` : '';
      console.log(`  ${r.name.padEnd(20)} ${status}${latency}`);
      if (r.models && r.models.length > 0) {
        console.log(`    Models: ${r.models.join(', ')}`);
      }
    }
    console.log('');
    return;
  }

  console.log(`Provider action '${action}' not recognized. Use: list, test, discover`);
}

function printUsage(): void {
  console.log(`
kairos-code v0.1.0 - Terminal-native AI coding agent

Usage:
  kairos                         Start TUI mode
  kairos -p "query"              Headless one-shot query
  kairos web                     Start web interface (port 3333)
  kairos web --port 8080         Start web on custom port
  kairos setup                   First-run interactive wizard
  kairos daemon                  Start background daemon
  kairos provider list           List all providers and status
  kairos provider discover       Auto-discover local providers
  kairos provider test <name>    Test provider connection
  kairos auth login|list|logout  Manage API keys
  kairos session list            List past sessions

Flags:
  -p, --prompt <query>           Run headless query
  --mode <mode>                  Agent mode (NORMAL/PLAN/AUTO/YOLO/etc)
  --compose                      Use 8-step compose pipeline
  -i, --interactive              Interactive CLI mode
  --daemon                       Start as daemon
  --help                         Show this help
  --version                      Show version
  `);
}
