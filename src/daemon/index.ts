import { join } from 'path';
import { unlinkSync, writeFileSync, readFileSync, existsSync } from 'fs';
import type { KairosConfigOutput } from '../config/schema.ts';
import { getKairosDir } from '../config/defaults.ts';
import { DEFAULT_CONFIG } from '../config/defaults.ts';
import { createLLMClient } from '../llm/client.ts';
import { ToolRegistry } from '../tools/registry.ts';
import { registerAllBuiltinTools } from '../tools/builtin/index.ts';
import { MemoryDatabase } from '../memory/database.ts';
import { AgentLoop } from '../agent/loop.ts';
import { getDbPath } from '../utils/paths.ts';
import { logger } from '../utils/logger.ts';
import { eventBus } from '../hooks/bus.ts';
import type { CliArgs } from '../cli/parser.ts';
import { getFlag } from '../cli/parser.ts';

interface Worker {
  id: number;
  busy: boolean;
  sessionId: string;
  agent: AgentLoop;
}

export interface DaemonState {
  pid: number;
  startedAt: Date;
  healthy: boolean;
  workers: Worker[];
  requestCount: number;
  errorCount: number;
}

let daemonState: DaemonState | null = null;
let server: ReturnType<typeof Bun.serve> | null = null;

export async function runDaemon(args: CliArgs): Promise<void> {
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as KairosConfigOutput;

  const port = Number(getFlag(args, 'port') ?? '7777');
  const maxWorkers = Number(getFlag(args, 'workers') ?? '4');

  const pidFile = join(getKairosDir(), 'daemon.pid');
  const logDir = join(getKairosDir(), 'logs');

  try {
    writeFileSync(pidFile, String(process.pid));
  } catch {}

  logger.enableFileLogging(logDir);

  const llm = createLLMClient(config.llm);
  const tools = new ToolRegistry();
  await registerAllBuiltinTools(tools);
  const memory = new MemoryDatabase(getDbPath());

  const workers: Worker[] = [];
  for (let i = 0; i < maxWorkers; i++) {
    workers.push({
      id: i,
      busy: false,
      sessionId: `daemon-worker-${i}`,
      agent: new AgentLoop(llm, tools, memory, config, {
        mode: 'HEADLESS',
        workspaceRoot: process.cwd(),
        sessionId: `daemon-worker-${i}`,
      }),
    });
  }

  daemonState = {
    pid: process.pid,
    startedAt: new Date(),
    healthy: true,
    workers,
    requestCount: 0,
    errorCount: 0,
  };

  logger.info(`Daemon started (PID: ${process.pid}, workers: ${maxWorkers})`);

  server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === '/health') {
        return Response.json({
          status: 'ok',
          pid: process.pid,
          uptime: process.uptime(),
          workers: daemonState?.workers.length ?? 0,
          busyWorkers: daemonState?.workers.filter((w) => w.busy).length ?? 0,
          requests: daemonState?.requestCount ?? 0,
          errors: daemonState?.errorCount ?? 0,
        });
      }

      if (url.pathname === '/query' && req.method === 'POST') {
        return handleQuery(req);
      }

      if (url.pathname === '/workers' && req.method === 'GET') {
        return Response.json({
          workers: daemonState?.workers.map((w) => ({
            id: w.id,
            busy: w.busy,
            sessionId: w.sessionId,
          })) ?? [],
        });
      }

      if (url.pathname === '/sessions' && req.method === 'GET') {
        const sessions = memory.getAllSessions();
        return Response.json({ sessions });
      }

      if (url.pathname === '/shutdown' && req.method === 'POST') {
        shutdown(pidFile, memory);
        return Response.json({ status: 'shutting_down' });
      }

      return new Response('Not Found', { status: 404 });
    },
  });

  logger.info(`Daemon listening on port ${server.port}`);

  process.on('SIGINT', () => shutdown(pidFile, memory));
  process.on('SIGTERM', () => shutdown(pidFile, memory));

  startWatchdog();
}

async function handleQuery(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { message?: string; mode?: string };
    const message = body.message;

    if (!message) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    if (!daemonState) {
      return Response.json({ error: 'Daemon not initialized' }, { status: 500 });
    }

    const worker = daemonState.workers.find((w) => !w.busy);
    if (!worker) {
      return Response.json({ error: 'All workers busy', retryAfter: 1 }, { status: 503 });
    }

    worker.busy = true;
    daemonState.requestCount++;

    await eventBus.emit('pre_tool_execution', { query: message, workerId: worker.id });

    try {
      const response = await worker.agent.run(message);

      await eventBus.emit('post_tool_execution', { query: message, workerId: worker.id, responseLength: response.response.length });

      return Response.json({
        response: response.response,
        workerId: worker.id,
        turns: response.turns.length,
      });
    } catch (e) {
      daemonState.errorCount++;
      return Response.json({ error: String(e), workerId: worker.id }, { status: 500 });
    } finally {
      worker.busy = false;
    }
  } catch (e) {
    if (daemonState) daemonState.errorCount++;
    return Response.json({ error: `Request failed: ${e}` }, { status: 500 });
  }
}

function shutdown(pidFile: string, memory: MemoryDatabase): void {
  logger.info('Daemon shutting down...');
  try {
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }
  } catch {}

  memory.close();
  server?.stop();
  daemonState = null;
  process.exit(0);
}

function startWatchdog(): void {
  setInterval(() => {
    if (!daemonState) return;
    daemonState.healthy = true;

    const busyWorkers = daemonState.workers.filter((w) => w.busy);

    if (busyWorkers.length > 0) {
      logger.warn(`${busyWorkers.length} workers busy`);
    }
  }, 60_000);
}
