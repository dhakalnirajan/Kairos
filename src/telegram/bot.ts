import { createLLMClient } from '../llm/client.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { registerAllBuiltinTools } from '../tools/builtin/index.ts';
import { MemoryDatabase } from '../memory/database.ts';
import { AgentLoop } from '../agent/loop.ts';
import { getDbPath } from '../utils/paths.ts';
import { logger } from '../utils/logger.ts';
import { eventBus } from '../hooks/bus.ts';
import { skillRunner } from '../skills/runner.ts';
import { LLMProviderManager } from '../llm/manager.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import type { AgentMode } from '../types/tools.ts';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; title?: string };
    from: { id: number; first_name: string; username?: string };
    text?: string;
    voice?: { file_id: string; duration: number };
    photo?: Array<{ file_id: string; width: number; height: number }>;
    document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
    reply_to_message?: { message_id: number; from?: { is_bot: boolean } };
    entities?: Array<{ type: string; offset: number; length: number; user?: { username: string } }>;
    date: number;
  };
}

interface UserSession {
  chatId: number;
  threadId?: number;
  userId: number;
  username: string;
  mode: AgentMode;
  agent: AgentLoop;
  busy: boolean;
  messageCount: number;
  lastActive: Date;
  streamingMsgId: number | null;
}

export interface TelegramConfig {
  token: string;
  allowedUserIds?: number[];
  allowedChats?: number[];
  requireMention?: boolean;
  mentionPatterns?: string[];
  maxConcurrent: number;
  messageTimeout: number;
  streamingEnabled: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  webhookPort: number;
  homeChannel?: number;
}

interface SendMessageResult {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

interface EditMessageResult {
  ok: boolean;
  description?: string;
}

interface TelegramApiResponse<T = unknown> {
  ok: boolean;
  result?: T;
  description?: string;
}

const COMMANDS: Record<string, { description: string; handler: (args: string, session: UserSession, bot: TelegramBot) => Promise<string> | string }> = {
  '/start': {
    description: 'Welcome message',
    handler: () => [
      '👋 Welcome to Kairos Code!',
      '',
      'I\'m a terminal-native AI coding agent. Send me any message and I\'ll help you with coding tasks.',
      '',
      'Type /help for all available commands.',
    ].join('\n'),
  },
  '/help': {
    description: 'Show all available commands',
    handler: () => [
      '📖 *Kairos Code Commands*',
      '',
      '*General*',
      '/start — Welcome message',
      '/help — Show this help',
      '/status — Show mode, messages, sessions',
      '/version — Show version info',
      '/health — System health check',
      '',
      '*Conversation*',
      '/new — Start new session',
      '/clear — Clear conversation history',
      '/undo — Undo last turn',
      '/compact — Compact context',
      '/dream — Consolidate memory',
      '',
      '*Mode & Model*',
      '/mode [name] — Show or switch mode',
      '/model [name] — Show or switch model',
      '',
      '*Provider*',
      '/provider list — List all providers',
      '/provider discover — Discover local providers',
      '/provider test <name> — Test provider connection',
      '',
      '*Session*',
      '/session list — List past sessions',
      '',
      '*Memory*',
      '/memory search <query> — Search memory',
      '/memory store <topic> <fact> — Store a fact',
      '/memory facts — List stored facts',
      '',
      '*Skills*',
      '/skill list — List available skills',
      '/skill run <name> — Run a skill',
      '/skill search <query> — Search skills',
      '',
      '*Tools*',
      '/tool list — List available tools',
      '/tool run <name> [params] — Execute a tool',
      '',
      '*Config*',
      '/config show — Show current config',
      '/config set <key> <value> — Set config value',
      '/config reset — Reset to defaults',
    ].join('\n'),
  },
  '/status': {
    description: 'Show current status',
    handler: (_args, session, bot) => {
      const sessions = bot.getSessions();
      return [
        '*Status*',
        `Mode: ${session.mode}`,
        `Messages: ${session.messageCount}`,
        `Active sessions: ${sessions.length}`,
        `Last active: ${session.lastActive.toLocaleString()}`,
      ].join('\n');
    },
  },
  '/version': {
    description: 'Show version info',
    handler: (_args, _session, bot) => {
      const config = bot.getConfig();
      return [
        '*Kairos Code*',
        `Version: ${config.version}`,
        `Provider: ${config.llm.provider}`,
        `Model: ${config.llm.model}`,
        `Tools: ${bot.getTools().getAll().length}`,
        `Skills: ${skillRunner.getAllSkills().length}`,
      ].join('\n');
    },
  },
  '/health': {
    description: 'System health check',
    handler: async (_args, _session, bot) => {
      const manager = new LLMProviderManager({ preferredProvider: bot.getConfig().llm.provider });
      const status = await manager.validateConnection();
      const config = bot.getConfig();
      return [
        '*Health Check*',
        `LLM: ${status.available ? '✓ Connected' : '✗ ' + (status.error ?? 'Unknown')}`,
        `Provider: ${config.llm.provider}`,
        `Model: ${config.llm.model}`,
        `Safety: ${config.safety.enabled ? 'Enabled' : 'Disabled'}`,
        `Memory: Enabled`,
        `Tools: ${bot.getTools().getAll().length} loaded`,
        `Skills: ${skillRunner.getAllSkills().length} loaded`,
      ].join('\n');
    },
  },
  '/mode': {
    description: 'Show or switch mode',
    handler: async (args, session) => {
      const mode = args.trim().toUpperCase();
      const valid: AgentMode[] = ['NORMAL', 'PLAN', 'ULTRAPLAN', 'AUTO', 'YOLO', 'HEADLESS', 'SWARM', 'DAEMON', 'DREAM', 'UNDERCOVER', 'VOICE'];
      if (!mode) {
        return `Current mode: *${session.mode}*\nAvailable: ${valid.join(', ')}`;
      }
      if (!valid.includes(mode as AgentMode)) {
        return `Invalid mode: ${mode}\nAvailable: ${valid.join(', ')}`;
      }
      session.mode = mode as AgentMode;
      session.agent.setMode(mode as AgentMode);
      return `Mode switched to *${mode}*`;
    },
  },
  '/model': {
    description: 'Show or switch model',
    handler: async (args, _session, bot) => {
      const config = bot.getConfig();
      if (!args.trim()) {
        return `Current model: *${config.llm.model}*\nProvider: ${config.llm.provider}`;
      }
      (config.llm as { model: string }).model = args.trim();
      return `Model switched to *${args.trim()}*`;
    },
  },
  '/clear': {
    description: 'Clear conversation history',
    handler: (_args, session, bot) => {
      session.agent = bot.createAgent(session);
      return '✓ Conversation cleared.';
    },
  },
  '/undo': {
    description: 'Undo last turn',
    handler: () => 'Undo not yet supported in Telegram mode.',
  },
  '/new': {
    description: 'Start new session',
    handler: (_args, session, bot) => {
      session.agent = bot.createAgent(session);
      session.messageCount = 0;
      return '✓ New session started.';
    },
  },
  '/compact': {
    description: 'Compact context',
    handler: () => 'Context compaction not yet supported in Telegram mode.',
  },
  '/dream': {
    description: 'Consolidate memory',
    handler: () => 'Memory consolidation not yet supported in Telegram mode.',
  },
  '/provider': {
    description: 'List, discover, or test providers',
    handler: async (args) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0] ?? 'list';

      if (action === 'list') {
        const manager = new LLMProviderManager();
        const providers = manager.listProviders();
        const local = providers.filter(p => p.isLocal).map(p => {
          const status = p.available === true ? '✓' : p.available === false ? '✗' : '?';
          return `  ${status} ${p.displayName}`;
        }).join('\n');
        const cloud = providers.filter(p => !p.isLocal).map(p => {
          const hasKey = p.envKey ? !!process.env[p.envKey] : false;
          return `  ${hasKey ? '✓' : '✗'} ${p.displayName}`;
        }).join('\n');
        return `*Local Providers:*\n${local}\n\n*Cloud Providers:*\n${cloud}`;
      }

      if (action === 'discover') {
        const manager = new LLMProviderManager({ autoDiscoverLocal: true });
        const results = await manager.discoverLocal();
        if (results.length === 0) return 'No local providers found.';
        return results.map(r => {
          const status = r.available ? '✓' : '✗';
          const latency = r.latencyMs ? ` (${r.latencyMs}ms)` : '';
          const models = r.models?.length ? `\n  Models: ${r.models.join(', ')}` : '';
          return `${status} ${r.name}${latency}${models}`;
        }).join('\n');
      }

      if (action === 'test') {
        const name = parts[1];
        if (!name) return 'Usage: /provider test <name>';
        const manager = new LLMProviderManager({ preferredProvider: name });
        const status = await manager.validateConnection();
        return status.available
          ? `✓ ${status.provider} is available`
          : `✗ ${status.provider} is not available: ${status.error}`;
      }

      return 'Usage: /provider [list|discover|test <name>]';
    },
  },
  '/session': {
    description: 'List past sessions',
    handler: async (_args, _session, bot) => {
      const sessions = bot.getMemory().getAllSessions();
      if (sessions.length === 0) return 'No sessions found.';
      return sessions.slice(0, 10).map(s =>
        `${s.id} — ${s.title || '(untitled)'} — ${s.updatedAt}`
      ).join('\n') + (sessions.length > 10 ? `\n... and ${sessions.length - 10} more` : '');
    },
  },
  '/memory': {
    description: 'Search, store, or list memory',
    handler: async (args, _session, bot) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0] ?? '';

      if (action === 'search' || action === 'find') {
        const query = parts.slice(1).join(' ');
        if (!query) return 'Usage: /memory search <query>';
        const results = bot.getMemory().search(query);
        if (results.length === 0) return `No results for "${query}"`;
        return results.slice(0, 5).map(r => {
          const fact = bot.getMemory().getTopicFact(r.rowid);
          return fact ? `• [${fact.topic}] ${fact.fact}` : `• Row ${r.rowid}`;
        }).join('\n');
      }

      if (action === 'store' || action === 'add') {
        const rest = parts.slice(1).join(' ');
        const colonIdx = rest.indexOf(':');
        if (colonIdx === -1) return 'Usage: /memory store <topic>: <fact>';
        const topic = rest.slice(0, colonIdx).trim();
        const fact = rest.slice(colonIdx + 1).trim();
        if (!topic || !fact) return 'Usage: /memory store <topic>: <fact>';
        bot.getMemory().insertTopicFact({ topic, fact, embedding: null });
        return `✓ Stored: [${topic}] ${fact}`;
      }

      if (action === 'facts') {
        const topic = parts[1];
        const facts = topic
          ? bot.getMemory().getTopicFactsByTopic(topic)
          : bot.getMemory().search('SELECT rowid, * FROM topic_facts ORDER BY rowid DESC LIMIT 10').map(r => bot.getMemory().getTopicFact(r.rowid)).filter(Boolean);
        if (facts.length === 0) return 'No facts stored.';
        return facts.slice(0, 10).map(f => `• [${f!.topic}] ${f!.fact}`).join('\n');
      }

      return 'Usage: /memory [search|store|facts]';
    },
  },
  '/skill': {
    description: 'List, search, or run skills',
    handler: async (args) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0] ?? 'list';

      await skillRunner.loadAllSkills();

      if (action === 'list') {
        const skills = skillRunner.getAllSkills();
        if (skills.length === 0) return 'No skills loaded.';
        return skills.map(s => `• ${s.name} (${s.category}) — ${s.description}`).join('\n');
      }

      if (action === 'search') {
        const query = parts.slice(1).join(' ');
        if (!query) return 'Usage: /skill search <query>';
        const results = skillRunner.searchSkills(query);
        if (results.length === 0) return `No skills matching "${query}"`;
        return results.map(s => `• ${s.name} — ${s.description}`).join('\n');
      }

      if (action === 'run') {
        const name = parts[1];
        if (!name) return 'Usage: /skill run <name> [--key value]';
        const skillArgs: Record<string, string> = {};
        const argParts = parts.slice(2);
        for (let i = 0; i < argParts.length; i += 2) {
          const key = argParts[i];
          if (key?.startsWith('--')) {
            skillArgs[key.slice(2)] = argParts[i + 1] ?? '';
          }
        }
        const result = await skillRunner.executeSkill(name, skillArgs);
        return result.success ? result.output : `Error: ${result.error}`;
      }

      return 'Usage: /skill [list|search <query>|run <name>]';
    },
  },
  '/tool': {
    description: 'List or run tools',
    handler: async (args, _session, bot) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0] ?? 'list';

      if (action === 'list') {
        const tools = bot.getTools().getManifests();
        return tools.map(t => `• ${t.name} (${t.riskLevel}) — ${t.description}`).join('\n');
      }

      if (action === 'run') {
        const name = parts[1];
        if (!name) return 'Usage: /tool run <name> [json-params]';
        let params: Record<string, unknown> = {};
        const paramsStr = parts.slice(2).join(' ');
        if (paramsStr) {
          try { params = JSON.parse(paramsStr); } catch { return 'Invalid JSON parameters'; }
        }
        const result = await bot.getTools().execute(name, params, { workspaceRoot: process.cwd(), sessionId: 'telegram' }, bot.getConfig());
        return result.success ? result.output : `Error: ${result.error}`;
      }

      return 'Usage: /tool [list|run <name> [params]]';
    },
  },
  '/config': {
    description: 'Show, set, or reset config',
    handler: async (args, _session, bot) => {
      const parts = args.trim().split(/\s+/);
      const action = parts[0] ?? 'show';
      const config = bot.getConfig();

      if (action === 'show') {
        return [
          '*Configuration*',
          `Provider: ${config.llm.provider}`,
          `Model: ${config.llm.model}`,
          `Max Tokens: ${config.llm.maxTokens}`,
          `Temperature: ${config.llm.temperature}`,
          `Safety: ${config.safety.enabled ? 'Enabled' : 'Disabled'}`,
          `Memory: ${config.memory.enabled ? 'Enabled' : 'Disabled'}`,
          `Tools: ${config.tools.enabled.join(', ')}`,
        ].join('\n');
      }

      if (action === 'set') {
        const key = parts[1];
        const value = parts.slice(2).join(' ');
        if (!key || !value) return 'Usage: /config set <key> <value>';
        const keys = key.split('.');
        let target: Record<string, unknown> = config as unknown as Record<string, unknown>;
        for (let i = 0; i < keys.length - 1; i++) {
          target = (target[keys[i]!] ?? {}) as Record<string, unknown>;
        }
        target[keys[keys.length - 1]!] = value;
        return `✓ Set ${key} = ${value}`;
      }

      if (action === 'reset') {
        return 'Config reset not yet supported in Telegram mode.';
      }

      return 'Usage: /config [show|set <key> <value>|reset]';
    },
  },
};

export class TelegramBot {
  private config: TelegramConfig;
  private kairosConfig: KairosConfigOutput;
  private sessions: Map<string, UserSession> = new Map();
  private llm: ReturnType<typeof createLLMClient>;
  private tools: ToolRegistry;
  private memory: MemoryDatabase;
  private running = false;
  private offset = 0;
  private webhookServer: ReturnType<typeof Bun.serve> | null = null;

  constructor(kairosConfig: KairosConfigOutput, telegramConfig: TelegramConfig) {
    this.config = telegramConfig;
    this.kairosConfig = kairosConfig;
    this.llm = createLLMClient(kairosConfig.llm);
    this.tools = new ToolRegistry();
    this.memory = new MemoryDatabase(getDbPath());
  }

  createAgent(session: { mode: AgentMode; chatId: number; threadId?: number }): AgentLoop {
    const sessionId = session.threadId
      ? `telegram-${session.chatId}-${session.threadId}`
      : `telegram-${session.chatId}`;
    return new AgentLoop(this.llm, this.tools, this.memory, this.kairosConfig, {
      mode: session.mode,
      workspaceRoot: process.cwd(),
      sessionId,
    });
  }

  private getSessionKey(chatId: number, threadId?: number): string {
    return threadId ? `${chatId}:${threadId}` : `${chatId}`;
  }

  private getOrCreateSession(chatId: number, threadId: number | undefined, userId: number, username: string): UserSession {
    const key = this.getSessionKey(chatId, threadId);
    let session = this.sessions.get(key);
    if (!session) {
      const mode = 'NORMAL';
      session = {
        chatId,
        threadId,
        userId,
        username,
        mode,
        agent: this.createAgent({ mode, chatId, threadId }),
        busy: false,
        messageCount: 0,
        lastActive: new Date(),
        streamingMsgId: null,
      };
      this.sessions.set(key, session);
    }
    session.username = username;
    return session;
  }

  async start(): Promise<void> {
    await registerAllBuiltinTools(this.tools);
    this.running = true;

    logger.info('Telegram bot starting...');

    const me = await this.api<{ id: number; first_name: string; username: string }>('getMe');
    if (!me) {
      throw new Error('Failed to get bot info from Telegram API');
    }

    logger.info(`Bot ready: @${me.username} (${me.first_name})`);

    if (this.config.webhookUrl) {
      await this.setupWebhook(me.username);
    } else {
      this.pollLoop();
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.webhookServer) {
      this.webhookServer.stop();
      this.webhookServer = null;
    }
    this.memory.close();
    logger.info('Telegram bot stopped');
  }

  private async setupWebhook(username: string): Promise<void> {
    const webhookUrl = `${this.config.webhookUrl}/telegram`;
    const deleteRes = await this.api('deleteWebhook');
    if (!deleteRes) logger.warn('Failed to delete existing webhook');

    const params: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    };
    if (this.config.webhookSecret) {
      params.secret_token = this.config.webhookSecret;
    }

    const setRes = await this.api('setWebhook', params);
    if (!setRes) throw new Error('Failed to set webhook');

    logger.info(`Webhook set: ${webhookUrl}`);

    this.webhookServer = Bun.serve({
      port: this.config.webhookPort,
      fetch: async (req) => {
        if (this.config.webhookSecret) {
          const secret = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
          if (secret !== this.config.webhookSecret) {
            return new Response('Unauthorized', { status: 401 });
          }
        }

        try {
          const update = await req.json() as TelegramUpdate;
          this.handleUpdate(update);
        } catch {}

        return new Response('OK');
      },
    });

    logger.info(`Webhook server listening on port ${this.config.webhookPort}`);
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.handleUpdate(update);
        }
      } catch (e) {
        logger.error(`Poll error: ${e}`);
        await this.sleep(5000);
      }
      await this.sleep(1000);
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.config.token}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=["message"]`,
        { signal: AbortSignal.timeout(35000) },
      );
      const data = await res.json() as { ok: boolean; result: TelegramUpdate[] };
      if (data.ok && data.result) {
        this.offset = Math.max(...data.result.map(u => u.update_id), this.offset) + 1;
        return data.result;
      }
    } catch {}
    return [];
  }

  private handleUpdate(update: TelegramUpdate): void {
    const msg = update.message;
    if (!msg?.text && !msg?.voice && !msg?.photo && !msg?.document) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.first_name || msg.from.username || 'unknown';
    const threadId = (msg as Record<string, unknown>)['message_thread_id'] as number | undefined;

    if (this.config.allowedUserIds && !this.config.allowedUserIds.includes(userId)) {
      this.sendMessage(chatId, '⛔ Unauthorized.', undefined, threadId);
      return;
    }

    if (this.config.allowedChats && !this.config.allowedChats.includes(chatId)) {
      return;
    }

    if (msg.chat.type !== 'private' && this.config.requireMention) {
      if (!this.isMentioned(msg)) return;
    }

    if (msg.text?.startsWith('/')) {
      this.handleCommand(msg.text, chatId, threadId, userId, username);
      return;
    }

    let text = msg.text ?? '';
    if (msg.voice) text = `[Voice message: ${msg.voice.duration}s]`;
    if (msg.photo) text = '[Image received]';
    if (msg.document) text = `[File: ${msg.document.file_name ?? 'unknown'}]`;

    if (text) {
      this.handleMessage(text, chatId, threadId, userId, username);
    }
  }

  private isMentioned(msg: TelegramUpdate['message']): boolean {
    if (!msg) return false;
    if (msg.reply_to_message?.from?.is_bot) return true;

    if (msg.entities) {
      for (const entity of msg.entities) {
        if (entity.type === 'mention' && entity.user?.username) {
          return true;
        }
      }
    }

    if (msg.text && this.config.mentionPatterns) {
      for (const pattern of this.config.mentionPatterns) {
        try {
          if (new RegExp(pattern, 'i').test(msg.text)) return true;
        } catch {}
      }
    }

    return false;
  }

  private async handleCommand(text: string, chatId: number, threadId: number | undefined, userId: number, username: string): Promise<void> {
    const parts = text.split(' ');
    const cmdName = parts[0]?.toLowerCase() ?? '';
    const cmdDef = COMMANDS[cmdName];

    const session = this.getOrCreateSession(chatId, threadId, userId, username);

    if (cmdDef) {
      try {
        const response = await cmdDef.handler(parts.slice(1).join(' '), session, this);
        await this.sendMessage(chatId, response, undefined, threadId);
      } catch (e) {
        await this.sendMessage(chatId, `❌ Error: ${String(e)}`, undefined, threadId);
      }
      return;
    }

    await this.sendMessage(chatId, `Unknown command: ${cmdName}\nType /help for available commands.`, undefined, threadId);
  }

  private async handleMessage(text: string, chatId: number, threadId: number | undefined, userId: number, username: string): Promise<void> {
    const session = this.getOrCreateSession(chatId, threadId, userId, username);
    session.lastActive = new Date();
    session.messageCount++;

    if (session.busy) {
      await this.sendMessage(chatId, '⏳ Please wait, I\'m still processing your previous message.', undefined, threadId);
      return;
    }

    session.busy = true;

    await eventBus.emit('pre_tool_execution', { source: 'telegram', chatId, userId });

    try {
      if (this.config.streamingEnabled) {
        await this.handleStreamingMessage(text, session);
      } else {
        await this.handleSimpleMessage(text, session);
      }
    } catch (e) {
      await this.sendMessage(chatId, `❌ Error: ${String(e)}`, undefined, threadId);
    } finally {
      session.busy = false;
      session.streamingMsgId = null;
    }

    await eventBus.emit('post_tool_execution', { source: 'telegram', chatId, userId });
  }

  private async handleSimpleMessage(text: string, session: UserSession): Promise<void> {
    const thinkingMsg = await this.sendMessage(session.chatId, '⏳ Thinking...', undefined, session.threadId);

    let fullResponse = '';
    for await (const event of session.agent.stream(text)) {
      if (event.type === 'token') fullResponse += event.content;
    }

    if (!fullResponse) fullResponse = '(no response)';
    await this.editMessage(session.chatId, thinkingMsg, this.formatResponse(fullResponse), session.threadId);
  }

  private async handleStreamingMessage(text: string, session: UserSession): Promise<void> {
    const msgId = await this.sendMessage(session.chatId, '⏳ Thinking...', undefined, session.threadId);
    session.streamingMsgId = msgId;

    let fullResponse = '';
    let lastEdit = 0;
    const editInterval = 1500;

    for await (const event of session.agent.stream(text)) {
      if (event.type === 'token') {
        fullResponse += event.content;

        const now = Date.now();
        if (now - lastEdit > editInterval && session.streamingMsgId === msgId) {
          const preview = this.formatResponse(fullResponse) + ' ▌';
          await this.editMessage(session.chatId, msgId, preview, session.threadId);
          lastEdit = now;
        }
      }

      if ('name' in event && event.type === 'tool_call') {
        const toolPreview = `\n\n🔧 ${event.name}...`;
        fullResponse += toolPreview;
      }
    }

    if (session.streamingMsgId === msgId) {
      await this.editMessage(session.chatId, msgId, this.formatResponse(fullResponse), session.threadId);
    }
  }

  private formatResponse(text: string): string {
    let formatted = text;
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `\`\`\`${lang}\n${code}\`\`\``);
    formatted = formatted.replace(/`([^`]+)`/g, '`$1`');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '*$1*');
    if (formatted.length > 4000) {
      formatted = formatted.slice(0, 3950) + '\n\n... (truncated)';
    }
    return formatted;
  }

  private async api<T = unknown>(method: string, body?: Record<string, unknown>): Promise<T | null> {
    try {
      const url = `https://api.telegram.org/bot${this.config.token}/${method}`;
      const opts: RequestInit = body
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }
        : { signal: AbortSignal.timeout(15000) };
      const res = await fetch(url, opts);
      const data = await res.json() as TelegramApiResponse<T>;
      if (data.ok) return data.result ?? null;
      logger.error(`Telegram API ${method} failed: ${data.description}`);
      return null;
    } catch (e) {
      logger.error(`Telegram API ${method} error: ${e}`);
      return null;
    }
  }

  private async sendMessage(chatId: number, text: string, replyTo?: number, threadId?: number): Promise<number | null> {
    const params: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };
    if (replyTo) params.reply_to_message_id = replyTo;
    if (threadId) params.message_thread_id = threadId;

    const res = await this.api<{ message_id: number }>('sendMessage', params);
    if (res) return res.message_id;

    if (text.includes('`') || text.includes('*')) {
      delete params.parse_mode;
      const plainRes = await this.api<{ message_id: number }>('sendMessage', params);
      if (plainRes) return plainRes.message_id;
    }

    return null;
  }

  private async editMessage(chatId: number, messageId: number | null, text: string, threadId?: number): Promise<void> {
    if (!messageId) {
      await this.sendMessage(chatId, text, undefined, threadId);
      return;
    }

    const params: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    const res = await this.api('editMessageText', params);
    if (!res && text.includes('`')) {
      delete params.parse_mode;
      await this.api('editMessageText', params);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSessions(): Array<{ chatId: number; threadId?: number; username: string; mode: string; messages: number; lastActive: string }> {
    return Array.from(this.sessions.values()).map(s => ({
      chatId: s.chatId,
      threadId: s.threadId,
      username: s.username,
      mode: s.mode,
      messages: s.messageCount,
      lastActive: s.lastActive.toISOString(),
    }));
  }

  getConfig(): KairosConfigOutput {
    return this.kairosConfig;
  }

  getTools(): ToolRegistry {
    return this.tools;
  }

  getMemory(): MemoryDatabase {
    return this.memory;
  }
}
