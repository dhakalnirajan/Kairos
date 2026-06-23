import type { ToolInstance, ToolContext, ToolResult } from '../../../types/tools.ts';
import { MemoryDatabase } from '../../../memory/database.ts';
import { getDbPath } from '../../../utils/paths.ts';
import { estimateTokens } from '../../../utils/tokenizer.ts';

let db: MemoryDatabase | null = null;

function getDb(): MemoryDatabase {
  if (!db) {
    db = new MemoryDatabase(getDbPath());
  }
  return db;
}

export const memoryOpsTool: ToolInstance = {
  name: 'memory_ops',
  description: 'Search, store, or retrieve facts from persistent memory (BM25 full-text search)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['search', 'store', 'get', 'delete'], description: 'Memory operation to perform' },
      query: { type: 'string', description: 'Search query (for search) or fact content (for store)' },
      topic: { type: 'string', description: 'Topic category (for store/get)' },
      id: { type: 'number', description: 'Fact ID (for get/delete)' },
      limit: { type: 'number', description: 'Max results for search (default 10)' },
    },
    required: ['operation'],
  },
  riskLevel: 'read',
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const operation = String(params['operation'] ?? '');

    try {
      const memory = getDb();

      switch (operation) {
        case 'search': {
          const query = String(params['query'] ?? '');
          if (!query) return { success: false, output: '', error: 'Query is required for search' };
          const limit = Number(params['limit']) || 10;
          const results = memory.search(query, limit);
          return {
            success: true,
            output: results.length > 0
              ? results.map((r, i) => `${i + 1}. [rowid=${r.rowid}] rank=${r.rank.toFixed(3)}`).join('\n')
              : 'No results found',
            metadata: { count: results.length },
          };
        }

        case 'store': {
          const topic = String(params['topic'] ?? 'general');
          const query = String(params['query'] ?? '');
          if (!query) return { success: false, output: '', error: 'Query/content is required for store' };
          const fact = memory.insertTopicFact({ topic, fact: query, embedding: null });
          return {
            success: true,
            output: `Stored fact #${fact.id} under topic "${topic}"`,
            metadata: { id: fact.id, topic },
          };
        }

        case 'get': {
          const id = Number(params['id']);
          if (!id) return { success: false, output: '', error: 'ID is required for get' };
          const fact = memory.getTopicFact(id);
          if (!fact) return { success: false, output: '', error: `Fact #${id} not found` };
          return {
            success: true,
            output: `[#${fact.id}] topic="${fact.topic}" fact="${fact.fact}"`,
            metadata: { id: fact.id, topic: fact.topic },
          };
        }

        case 'delete': {
          const id = Number(params['id']);
          if (!id) return { success: false, output: '', error: 'ID is required for delete' };
          memory.deleteTopicFact(id);
          return { success: true, output: `Deleted fact #${id}` };
        }

        default:
          return { success: false, output: '', error: `Unknown operation: ${operation}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Memory operation failed: ${e}` };
    }
  },
};
