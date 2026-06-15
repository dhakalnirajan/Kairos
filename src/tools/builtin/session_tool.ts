import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { SessionRecorder } from '../session.ts';

const activeRecorders = new Map<string, SessionRecorder>();

export const sessionTool: ToolInstance = {
  name: 'session_recorder',
  description: 'Session recording: record events, save/load sessions, export as JSON/Markdown',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'record', 'end', 'load', 'list', 'events', 'duration', 'export'], description: 'Session action' },
      session_id: { type: 'string', description: 'Session ID' },
      type: { type: 'string', enum: ['user', 'assistant', 'tool', 'system'], description: 'Event type' },
      content: { type: 'string', description: 'Event content' },
      format: { type: 'string', enum: ['json', 'markdown'], description: 'Export format' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'start': {
          const sessionId = String(params['session_id'] ?? `session-${Date.now()}`);
          const recorder = new SessionRecorder(sessionId);
          activeRecorders.set(sessionId, recorder);
          return { success: true, output: `Started recording: ${sessionId}` };
        }
        case 'record': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          let recorder = activeRecorders.get(sessionId);
          if (!recorder) {
            recorder = new SessionRecorder(sessionId);
            activeRecorders.set(sessionId, recorder);
          }
          const type = String(params['type'] ?? 'user') as 'user' | 'assistant' | 'tool' | 'system';
          const content = String(params['content'] ?? '');
          recorder.record(type, content);
          return { success: true, output: `Recorded ${type} event in ${sessionId}` };
        }
        case 'end': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          const recorder = activeRecorders.get(sessionId);
          if (!recorder) return { success: false, output: '', error: `Session not found: ${sessionId}` };
          recorder.end();
          activeRecorders.delete(sessionId);
          return { success: true, output: `Ended session: ${sessionId}` };
        }
        case 'load': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          const session = await SessionRecorder.loadSession(sessionId);
          return session
            ? { success: true, output: `Session ${session.id}: ${session.events.length} events, ${session.endTime ? 'complete' : 'active'}` }
            : { success: false, output: '', error: `Session not found: ${sessionId}` };
        }
        case 'list': {
          const sessions = await SessionRecorder.listSessions();
          const output = sessions.map((s: string) => s).join('\n');
          return { success: true, output: output || 'No sessions', metadata: { count: sessions.length } };
        }
        case 'events': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          const session = await SessionRecorder.loadSession(sessionId);
          if (!session) return { success: false, output: '', error: `Session not found: ${sessionId}` };
          const output = session.events.map((e: { type: string; content: string }) => `[${e.type}] ${e.content.slice(0, 100)}`).join('\n');
          return { success: true, output, metadata: { count: session.events.length } };
        }
        case 'duration': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          const session = await SessionRecorder.loadSession(sessionId);
          if (!session) return { success: false, output: '', error: `Session not found: ${sessionId}` };
          const duration = session.endTime ? session.endTime - session.startTime : Date.now() - session.startTime;
          return { success: true, output: `Session duration: ${(duration / 1000).toFixed(1)}s` };
        }
        case 'export': {
          const sessionId = String(params['session_id'] ?? '');
          if (!sessionId) return { success: false, output: '', error: 'session_id required' };
          const session = await SessionRecorder.loadSession(sessionId);
          if (!session) return { success: false, output: '', error: `Session not found: ${sessionId}` };
          const format = String(params['format'] ?? 'json');
          const exported = format === 'markdown'
            ? `# Session ${session.id}\n\n${session.events.map((e: { type: string; content: string }) => `## ${e.type}\n${e.content}`).join('\n\n')}`
            : JSON.stringify(session, null, 2);
          return { success: true, output: exported };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Session recorder failed: ${e}` };
    }
  },
};
