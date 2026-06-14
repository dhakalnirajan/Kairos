import { join } from 'path';
import { getSessionsDir } from '../utils/paths.ts';
import { existsSync, mkdirSync } from 'fs';

export interface SessionEvent {
  timestamp: number;
  type: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  events: SessionEvent[];
  metadata: Record<string, unknown>;
}

export class SessionRecorder {
  private session: Session;
  private filePath: string;

  constructor(sessionId?: string) {
    const id = sessionId ?? `session-${Date.now()}`;
    this.session = {
      id,
      startTime: Date.now(),
      events: [],
      metadata: {},
    };

    const sessionsDir = getSessionsDir();
    if (!existsSync(sessionsDir)) {
      mkdirSync(sessionsDir, { recursive: true });
    }
    this.filePath = join(sessionsDir, `${id}.jsonl`);
  }

  record(type: SessionEvent['type'], content: string, metadata?: Record<string, unknown>): void {
    const event: SessionEvent = {
      timestamp: Date.now(),
      type,
      content,
      metadata,
    };
    this.session.events.push(event);
    this.appendToFile(event);
  }

  private appendToFile(event: SessionEvent): void {
    try {
      const line = JSON.stringify(event) + '\n';
      Bun.write(this.filePath, line);
    } catch {}
  }

  end(): void {
    this.session.endTime = Date.now();
  }

  getSession(): Session {
    return { ...this.session };
  }

  getEvents(): SessionEvent[] {
    return [...this.session.events];
  }

  getDuration(): number {
    const end = this.session.endTime ?? Date.now();
    return end - this.session.startTime;
  }

  static async loadSession(sessionId: string): Promise<Session | null> {
    const sessionsDir = getSessionsDir();
    const filePath = join(sessionsDir, `${sessionId}.jsonl`);

    try {
      const file = Bun.file(filePath);
      if (!(await file.exists())) return null;

      const content = await file.text();
      const lines = content.split('\n').filter(Boolean);
      const events: SessionEvent[] = [];

      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as SessionEvent);
        } catch {}
      }

      return {
        id: sessionId,
        startTime: events[0]?.timestamp ?? Date.now(),
        endTime: events[events.length - 1]?.timestamp,
        events,
        metadata: {},
      };
    } catch {
      return null;
    }
  }

  static async listSessions(): Promise<string[]> {
    const sessionsDir = getSessionsDir();
    try {
      const entries = await Array.fromAsync(
        new Bun.Glob('*.jsonl').scan({ cwd: sessionsDir })
      );
      return entries.map((e) => e.replace('.jsonl', ''));
    } catch {
      return [];
    }
  }

  async exportToFile(format: 'json' | 'markdown' = 'json'): Promise<string> {
    const session = this.getSession();

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    const lines: string[] = [
      `# Session ${session.id}`,
      '',
      `Started: ${new Date(session.startTime).toISOString()}`,
      session.endTime ? `Ended: ${new Date(session.endTime).toISOString()}` : '',
      '',
      '## Events',
      '',
    ];

    for (const event of session.events) {
      const time = new Date(event.timestamp).toISOString().slice(11, 19);
      lines.push(`### [${time}] ${event.type}`);
      lines.push(event.content);
      lines.push('');
    }

    return lines.join('\n');
  }
}
