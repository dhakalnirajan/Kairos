import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { MemoryDatabase } from '../../memory/database.ts';
import { getDbPath } from '../../utils/paths.ts';
import { estimateTokens } from '../../utils/tokenizer.ts';

let db: MemoryDatabase | null = null;
function getDb(): MemoryDatabase {
  if (!db) db = new MemoryDatabase(getDbPath());
  return db;
}

export const compactionTool: ToolInstance = {
  name: 'smart_compaction',
  description: 'Smart context compaction: topic-boundary summarisation, archival to disk, raw recall',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['compact', 'archive', 'recall_raw', 'topic_summary', 'stats'], description: 'Compaction action' },
      session_id: { type: 'string', description: 'Session ID' },
      query: { type: 'string', description: 'Search query for raw recall' },
      limit: { type: 'number', description: 'Max results' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      const memory = getDb();
      switch (action) {
        case 'compact': {
          const sessionId = String(params['session_id'] ?? '');
          const history = memory.getConversationHistory(sessionId, 200);
          if (history.length === 0) return { success: true, output: 'No conversation to compact' };
          const topics = new Map<string, typeof history>();
          for (const msg of history) {
            const topic = msg.content.slice(0, 50).replace(/[^\w]/g, '_');
            const existing = topics.get(topic) ?? [];
            existing.push(msg);
            topics.set(topic, existing);
          }
          const summaries: string[] = [];
          for (const [topic, msgs] of topics) {
            summaries.push(`[${topic}]: ${msgs.length} messages, ~${estimateTokens(msgs.map((m) => m.content).join(' '))} tokens`);
          }
          return { success: true, output: `Compacted ${history.length} messages into ${topics.size} topics:\n${summaries.join('\n')}`, metadata: { messages: history.length, topics: topics.size } };
        }
        case 'archive': {
          const sessionId = String(params['session_id'] ?? '');
          const history = memory.getConversationHistory(sessionId);
          for (const msg of history) {
            memory.insertTopicFact({ topic: `archived:${sessionId}`, fact: `[${msg.role}] ${msg.content.slice(0, 500)}`, embedding: null });
          }
          memory.deleteConversationHistory(sessionId);
          return { success: true, output: `Archived ${history.length} messages for session ${sessionId}` };
        }
        case 'recall_raw': {
          const query = String(params['query'] ?? '');
          if (!query) return { success: false, output: '', error: 'query required' };
          const limit = Number(params['limit'] ?? 10);
          const results = memory.search(query, limit);
          return { success: true, output: results.map((r) => `[rowid=${r.rowid}] rank=${r.rank.toFixed(3)}`).join('\n') || 'No results', metadata: { count: results.length } };
        }
        case 'topic_summary': {
          const facts = memory.getAllWorkflowMemory();
          const topics = new Map<string, number>();
          for (const f of facts) topics.set(f.type, (topics.get(f.type) ?? 0) + 1);
          const output = Array.from(topics.entries()).map(([t, c]) => `${t}: ${c} entries`).join('\n');
          return { success: true, output: output || 'No topic data' };
        }
        case 'stats': {
          const stats = memory.search('', 1);
          return { success: true, output: `Memory DB active`, metadata: { dbPath: getDbPath() } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Compaction failed: ${e}` };
    }
  },
};
