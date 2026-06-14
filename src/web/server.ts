import { createLLMClient } from '../llm/client.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { registerAllBuiltinTools } from '../tools/builtin/index.ts';
import { MemoryDatabase } from '../memory/database.ts';
import { AgentLoop } from '../agent/loop.ts';
import { getDbPath } from '../utils/paths.ts';
import { FRONTEND_HTML } from './frontend.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import type { AgentMode } from '../types/tools.ts';

export interface WebServerConfig {
  port: number;
  host: string;
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
    console.log('Start llama-server first, or set KAIROS_LLM_API_KEY env var');
  }

  console.log(`Using provider: ${effectiveConfig.llm.provider} | Model: ${effectiveConfig.llm.model}`);

  const llm = createLLMClient(effectiveConfig.llm);
  const tools = new ToolRegistry();
  await registerAllBuiltinTools(tools);
  const memory = new MemoryDatabase(getDbPath());

  let currentMode: AgentMode = 'HEADLESS';

  const server = Bun.serve({
    port: opts.port,
    hostname: opts.host,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/' && req.method === 'GET') {
        return new Response(FRONTEND_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }

      if (url.pathname === '/api/chat' && req.method === 'POST') {
        return handleChat(req, config, llm, tools, memory, currentMode);
      }

      if (url.pathname === '/api/tools' && req.method === 'GET') {
        return Response.json({ tools: tools.getManifests().map((t) => t.name) });
      }

      if (url.pathname === '/api/status' && req.method === 'GET') {
        return Response.json({
          model: config.llm.model,
          mode: currentMode,
          provider: config.llm.provider,
          version: config.version,
        });
      }

      if (url.pathname === '/api/model' && req.method === 'POST') {
        return req.json().then((body) => {
          const { model } = body as { model?: string };
          if (model) (config.llm as { model: string }).model = model;
          return Response.json({ ok: true, model: config.llm.model });
        });
      }

      if (url.pathname === '/api/mode' && req.method === 'POST') {
        return req.json().then((body) => {
          const { mode } = body as { mode?: string };
          if (mode && ['NORMAL', 'PLAN', 'ULTRAPLAN', 'AUTO', 'YOLO', 'HEADLESS'].includes(mode)) {
            currentMode = mode as AgentMode;
          }
          return Response.json({ ok: true, mode: currentMode });
        });
      }

      if (url.pathname === '/api/sessions' && req.method === 'GET') {
        const sessions = memory.getAllSessions();
        return Response.json({ sessions });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  console.log(`\x1b[36mKairos Code web interface running at http://${opts.host}:${opts.port}\x1b[0m`);
  console.log(`\x1b[90mOpen in browser or SSH tunnel: ssh -L ${opts.port}:localhost:${opts.port} remote-host\x1b[0m\n`);

  const shutdown = () => {
    console.log('\nShutting down web server...');
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

  if (!message) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

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
          if (event.type === 'token') {
            send({ type: 'token', content: event.content });
          }
          if (event.type === 'done') {
            send({ type: 'done', usage: event.usage });
          }
          if ('name' in event && event.type === 'tool_call') {
            send({ type: 'tool_call', name: event.name, result: event.result });
          }
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
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
