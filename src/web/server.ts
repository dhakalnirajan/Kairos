import { createLLMClient } from '../llm/client.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { registerAllBuiltinTools } from '../tools/builtin/index.ts';
import { MemoryDatabase } from '../memory/database.ts';
import { AgentLoop } from '../agent/loop.ts';
import { getDbPath } from '../utils/paths.ts';
import { FRONTEND_HTML } from './frontend.ts';
import { loadConfig, saveConfig } from '../config/index.ts';
import { skillRunner } from '../skills/runner.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import type { AgentMode } from '../types/tools.ts';

export interface WebServerConfig {
  port: number;
  host: string;
}

type Route = {
  method: string;
  pattern: RegExp;
  params: string[];
  handler: (req: Request, params: Record<string, string>) => Promise<Response> | Response;
};

function route(method: string, path: string, handler: Route['handler']): Route {
  const paramNames: string[] = [];
  const pattern = path.replace(/:([^/]+)/g, (_m, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${pattern}$`), params: paramNames, handler };
}

function matchRoute(routes: Route[], method: string, pathname: string): { handler: Route['handler']; params: Record<string, string> } | null {
  for (const r of routes) {
    if (r.method !== method && r.method !== '*') continue;
    const m = pathname.match(r.pattern);
    if (m) {
      const params: Record<string, string> = {};
      r.params.forEach((name, i) => { params[name] = m[i + 1]!; });
      return { handler: r.handler, params };
    }
  }
  return null;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
  });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function startWebServer(config: KairosConfigOutput, opts: WebServerConfig): Promise<void> {
  const effectiveConfig = JSON.parse(JSON.stringify(config)) as KairosConfigOutput;

  let detectedLocal = false;
  try {
    const probe = await fetch('http://localhost:8080/health', { signal: AbortSignal.timeout(2000) });
    if (probe.ok) {
      effectiveConfig.llm = { ...effectiveConfig.llm, provider: 'llamacpp', baseUrl: 'http://localhost:8080' };
      detectedLocal = true;
    }
  } catch {}

  if (!detectedLocal && !effectiveConfig.llm.apiKey) {
    console.log('\x1b[33mWarning: No API key set and no local LLM detected on :8080\x1b[0m');
  }

  console.log(`Using provider: ${effectiveConfig.llm.provider} | Model: ${effectiveConfig.llm.model}`);

  const llm = createLLMClient(effectiveConfig.llm);
  const tools = new ToolRegistry();
  await registerAllBuiltinTools(tools);
  const memory = new MemoryDatabase(getDbPath());
  await skillRunner.loadAllSkills();

  let currentMode: AgentMode = 'HEADLESS';
  const startTime = Date.now();

  const routes: Route[] = [
    // ── Health ──
    route('GET', '/api/health', () => json({ status: 'ok', uptime: Date.now() - startTime, version: config.version })),

    // ── Status ──
    route('GET', '/api/status', () => json({
      model: effectiveConfig.llm.model,
      mode: currentMode,
      provider: effectiveConfig.llm.provider,
      version: config.version,
      tools: tools.getAll().length,
      skills: skillRunner.getAllSkills().length,
      uptime: Date.now() - startTime,
    })),

    // ── Chat ──
    route('POST', '/api/chat', (req) => handleChat(req, effectiveConfig, llm, tools, memory, currentMode)),

    // ── Tools ──
    route('GET', '/api/tools', () => json({ tools: tools.getManifests() })),
    route('GET', '/api/tools/:name', (_req, p) => {
      const name = p.name;
      if (!name) return err('Tool name required');
      const manifest = tools.getManifests().find(t => t.name === name);
      return manifest ? json(manifest) : err(`Tool not found: ${name}`, 404);
    }),
    route('POST', '/api/tools/:name/execute', async (req, p) => {
      const name = p.name;
      if (!name) return err('Tool name required');
      const body = await req.json() as Record<string, unknown>;
      const result = await tools.execute(name, (body.params ?? {}) as Record<string, unknown>, { workspaceRoot: process.cwd(), sessionId: 'api' }, effectiveConfig);
      return json(result);
    }),

    // ── Skills ──
    route('GET', '/api/skills', () => json({ skills: skillRunner.getAllSkills().map(s => ({ name: s.name, description: s.description, category: s.category, version: s.version })) })),
    route('GET', '/api/skills/search', (req) => {
      const q = new URL(req.url).searchParams.get('q') ?? '';
      return json({ skills: skillRunner.searchSkills(q) });
    }),
    route('GET', '/api/skills/:name', (_req, p) => {
      const name = p.name;
      if (!name) return err('Skill name required');
      const skill = skillRunner.getSkill(name);
      return skill ? json(skill) : err(`Skill not found: ${name}`, 404);
    }),
    route('POST', '/api/skills/:name/run', async (req, p) => {
      const name = p.name;
      if (!name) return err('Skill name required');
      const body = await req.json() as { args?: Record<string, string> };
      const result = await skillRunner.executeSkill(name, body.args ?? {});
      return json(result);
    }),

    // ── Memory: Facts ──
    route('GET', '/api/memory/facts', (req) => {
      const topic = new URL(req.url).searchParams.get('topic');
      const facts = topic ? memory.getTopicFactsByTopic(topic) : memory.search('SELECT rowid, * FROM topic_facts ORDER BY rowid DESC LIMIT 100').map(r => memory.getTopicFact(r.rowid)).filter(Boolean);
      return json({ facts });
    }),
    route('POST', '/api/memory/facts', async (req) => {
      const body = await req.json() as { topic: string; fact: string };
      if (!body.topic || !body.fact) return err('topic and fact are required');
      const result = memory.insertTopicFact({ topic: body.topic, fact: body.fact, embedding: null });
      return json(result, 201);
    }),
    route('GET', '/api/memory/facts/:id', (_req, p) => {
      const fact = memory.getTopicFact(Number(p.id));
      return fact ? json(fact) : err('Fact not found', 404);
    }),
    route('DELETE', '/api/memory/facts/:id', (_req, p) => {
      memory.deleteTopicFact(Number(p.id));
      return json({ ok: true });
    }),

    // ── Memory: Search ──
    route('GET', '/api/memory/search', (req) => {
      const q = new URL(req.url).searchParams.get('q') ?? '';
      if (!q) return err('q parameter is required');
      const results = memory.search(q).map(r => ({ ...r, fact: memory.getTopicFact(r.rowid) }));
      return json({ results });
    }),

    // ── Memory: Sessions ──
    route('GET', '/api/memory/sessions', () => json({ sessions: memory.getAllSessions() })),
    route('GET', '/api/memory/sessions/:id', (_req, p) => {
      const id = p.id;
      if (!id) return err('Session ID required');
      const session = memory.getSession(id);
      return session ? json(session) : err('Session not found', 404);
    }),
    route('DELETE', '/api/memory/sessions/:id', (_req, p) => {
      const id = p.id;
      if (!id) return err('Session ID required');
      memory.deleteSession(id);
      return json({ ok: true });
    }),
    route('GET', '/api/memory/conversation/:sessionId', (req, p) => {
      const sessionId = p.sessionId;
      if (!sessionId) return err('Session ID required');
      const limit = Number(new URL(req.url).searchParams.get('limit') ?? '50');
      const history = memory.getConversationHistory(sessionId, limit);
      return json({ history });
    }),

    // ── Memory: Audit ──
    route('GET', '/api/memory/audit', (req) => {
      const url = new URL(req.url);
      const limit = Number(url.searchParams.get('limit') ?? '100');
      const toolName = url.searchParams.get('tool') ?? undefined;
      const logs = memory.getAuditLogs(limit, toolName);
      return json({ logs });
    }),

    // ── Sessions (convenience alias) ──
    route('GET', '/api/sessions', () => json({ sessions: memory.getAllSessions() })),
    route('GET', '/api/sessions/:id', (_req, p) => {
      const id = p.id;
      if (!id) return err('Session ID required');
      const session = memory.getSession(id);
      return session ? json(session) : err('Session not found', 404);
    }),
    route('DELETE', '/api/sessions/:id', (_req, p) => {
      const id = p.id;
      if (!id) return err('Session ID required');
      memory.deleteSession(id);
      return json({ ok: true });
    }),

    // ── Config ──
    route('GET', '/api/config', () => json({ config: effectiveConfig })),
    route('PUT', '/api/config', async (req) => {
      const body = await req.json() as Partial<KairosConfigOutput>;
      Object.assign(effectiveConfig, body);
      await saveConfig(effectiveConfig);
      return json({ ok: true, config: effectiveConfig });
    }),

    // ── Mode ──
    route('POST', '/api/mode', async (req) => {
      const body = await req.json() as { mode?: string };
      if (body.mode && ['NORMAL', 'PLAN', 'ULTRAPLAN', 'AUTO', 'YOLO', 'HEADLESS', 'SWARM', 'DAEMON', 'DREAM', 'UNDERCOVER', 'VOICE'].includes(body.mode)) {
        currentMode = body.mode as AgentMode;
      }
      return json({ ok: true, mode: currentMode });
    }),

    // ── Model ──
    route('POST', '/api/model', async (req) => {
      const body = await req.json() as { model?: string };
      if (body.model) (effectiveConfig.llm as { model: string }).model = body.model;
      return json({ ok: true, model: effectiveConfig.llm.model });
    }),
  ];

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    fetch(req) {
      const url = new URL(req.url);

      if (req.method === 'OPTIONS') {
        return new Response(null, {
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
        });
      }

      if (url.pathname === '/' && req.method === 'GET') {
        return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      const matched = matchRoute(routes, req.method, url.pathname);
      if (matched) {
        try {
          const result = matched.handler(req, matched.params);
          return result instanceof Promise ? result : Promise.resolve(result);
        } catch (e) {
          return err(String(e), 500);
        }
      }

      return err('Not Found', 404);
    },
  });

  console.log(`\x1b[36mKairos Code API running at http://${opts.host}:${opts.port}\x1b[0m`);
  console.log(`\x1b[90mEndpoints: /api/health, /api/status, /api/chat, /api/tools, /api/skills, /api/memory/*, /api/config, /api/sessions\x1b[0m`);
  console.log(`\x1b[90mSSH tunnel: ssh -L ${opts.port}:localhost:${opts.port} remote-host\x1b[0m\n`);

  const shutdown = () => {
    console.log('\nShutting down...');
    memory.close();
    server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function handleChat(
  req: Request,
  config: KairosConfigOutput,
  llm: ReturnType<typeof createLLMClient>,
  tools: ToolRegistry,
  memory: MemoryDatabase,
  mode: AgentMode,
): Promise<Response> {
  const body = (await req.json()) as { message?: string; stream?: boolean };
  const message = body.message;
  if (!message) return err('Message is required');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const agent = new AgentLoop(llm, tools, memory, config, {
          mode,
          workspaceRoot: process.cwd(),
          sessionId: `web-${Date.now()}`,
        });

        for await (const event of agent.stream(message)) {
          if (event.type === 'token') send({ type: 'token', content: event.content });
          if (event.type === 'done') send({ type: 'done', usage: event.usage });
          if ('name' in event && event.type === 'tool_call') send({ type: 'tool_call', name: event.name, result: event.result });
        }

        send({ type: 'done', usage: { promptTokens: 0, completionTokens: 0 } });
      } catch (e) {
        send({ type: 'error', message: String(e) });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' },
  });
}
