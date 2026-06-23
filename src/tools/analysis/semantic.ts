import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export interface EmbeddingEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  updatedAt: number;
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class SemanticIndex {
  private entries: Map<string, EmbeddingEntry> = new Map();
  private indexVersion = 0;

  addEntry(entry: EmbeddingEntry): void {
    this.entries.set(entry.id, entry);
    this.indexVersion++;
  }

  removeEntry(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) this.indexVersion++;
    return deleted;
  }

  getEntry(id: string): EmbeddingEntry | undefined {
    return this.entries.get(id);
  }

  clear(): void {
    this.entries.clear();
    this.indexVersion++;
  }

  size(): number {
    return this.entries.size;
  }

  getVersion(): number {
    return this.indexVersion;
  }

  search(queryEmbedding: number[], topK: number = 5): SearchResult[] {
    const results: SearchResult[] = [];

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({
        id: entry.id,
        text: entry.text,
        score,
        metadata: entry.metadata,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  searchByText(query: string, topK: number = 5): SearchResult[] {
    const queryEmbedding = simpleHashEmbedding(query);

    const results: SearchResult[] = [];
    for (const entry of this.entries.values()) {
      const score = textSimilarity(query.toLowerCase(), entry.text.toLowerCase());
      results.push({
        id: entry.id,
        text: entry.text,
        score,
        metadata: entry.metadata,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  getAll(): EmbeddingEntry[] {
    return Array.from(this.entries.values());
  }

  exportIndex(): EmbeddingEntry[] {
    return Array.from(this.entries.values());
  }

  importIndex(entries: EmbeddingEntry[]): void {
    this.entries.clear();
    for (const entry of entries) {
      this.entries.set(entry.id, entry);
    }
    this.indexVersion++;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dotProduct += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

function simpleHashEmbedding(text: string): number[] {
  const dimensions = 64;
  const embedding: number[] = new Array(dimensions).fill(0);

  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }

    for (let i = 0; i < dimensions; i++) {
      const idx = (hash + i * 31) % dimensions;
      embedding[idx]! += 1;
    }
  }

  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = embedding[i]! / norm;
    }
  }

  return embedding;
}

function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }

  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const semanticIndex = new SemanticIndex();

export const semanticTool: ToolInstance = {
  name: 'semantic',
  description: 'Semantic search with local embedding index, natural language queries, and incremental rebuilds',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'remove', 'search', 'search_text', 'get', 'clear', 'stats', 'export', 'import'],
        description: 'Action to perform',
      },
      id: { type: 'string', description: 'Entry ID' },
      text: { type: 'string', description: 'Text content to index' },
      embedding: {
        type: 'array',
        items: { type: 'number' },
        description: 'Pre-computed embedding vector',
      },
      query: { type: 'string', description: 'Search query text' },
      topK: { type: 'number', description: 'Number of results to return (default 5)' },
      metadata: { type: 'object', description: 'Metadata to attach to entry' },
      entries: {
        type: 'array',
        description: 'Entries for bulk import',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            embedding: { type: 'array', items: { type: 'number' } },
            metadata: { type: 'object' },
          },
        },
      },
    },
    required: ['action'],
  },
  riskLevel: 'read',
  isIdempotent: false,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    switch (action) {
      case 'add': {
        const id = String(params['id'] ?? `entry-${Date.now()}`);
        const text = String(params['text'] ?? '');
        const embedding = (params['embedding'] as number[]) ?? simpleHashEmbedding(text);
        const metadata = (params['metadata'] as Record<string, unknown>) ?? {};

        semanticIndex.addEntry({
          id,
          text,
          embedding,
          metadata,
          updatedAt: Date.now(),
        });

        return {
          success: true,
          output: `Added entry "${id}" (${text.length} chars)`,
          metadata: { id, indexSize: semanticIndex.size() },
        };
      }

      case 'remove': {
        const id = String(params['id'] ?? '');
        if (!id) {
          return { success: false, output: '', error: 'No id provided' };
        }

        const removed = semanticIndex.removeEntry(id);
        return {
          success: removed,
          output: removed ? `Removed entry "${id}"` : `Entry "${id}" not found`,
          metadata: { indexSize: semanticIndex.size() },
        };
      }

      case 'search': {
        const embedding = params['embedding'] as number[];
        const topK = Number(params['topK']) || 5;

        if (!embedding || embedding.length === 0) {
          return { success: false, output: '', error: 'No embedding provided' };
        }

        const results = semanticIndex.search(embedding, topK);
        const output = results
          .map((r) => `[${r.score.toFixed(3)}] ${r.id}: ${r.text.slice(0, 100)}`)
          .join('\n');

        return {
          success: true,
          output: output || 'No results found',
          metadata: { results },
        };
      }

      case 'search_text': {
        const query = String(params['query'] ?? '');
        const topK = Number(params['topK']) || 5;

        if (!query) {
          return { success: false, output: '', error: 'No query provided' };
        }

        const results = semanticIndex.searchByText(query, topK);
        const output = results
          .map((r) => `[${r.score.toFixed(3)}] ${r.id}: ${r.text.slice(0, 100)}`)
          .join('\n');

        return {
          success: true,
          output: output || 'No results found',
          metadata: { results },
        };
      }

      case 'get': {
        const id = String(params['id'] ?? '');
        const entry = semanticIndex.getEntry(id);

        if (!entry) {
          return { success: false, output: '', error: `Entry "${id}" not found` };
        }

        return {
          success: true,
          output: `ID: ${entry.id}\nText: ${entry.text}\nUpdated: ${new Date(entry.updatedAt).toISOString()}\nMetadata: ${JSON.stringify(entry.metadata)}`,
          metadata: { entry },
        };
      }

      case 'clear': {
        semanticIndex.clear();
        return { success: true, output: 'Index cleared', metadata: { indexSize: 0 } };
      }

      case 'stats': {
        return {
          success: true,
          output: `Index size: ${semanticIndex.size()}\nVersion: ${semanticIndex.getVersion()}`,
          metadata: {
            size: semanticIndex.size(),
            version: semanticIndex.getVersion(),
          },
        };
      }

      case 'export': {
        const entries = semanticIndex.exportIndex();
        return {
          success: true,
          output: JSON.stringify(entries),
          metadata: { count: entries.length },
        };
      }

      case 'import': {
        const entries = params['entries'] as EmbeddingEntry[] | undefined;
        if (!entries || !Array.isArray(entries)) {
          return { success: false, output: '', error: 'No entries provided' };
        }

        semanticIndex.importIndex(entries);
        return {
          success: true,
          output: `Imported ${entries.length} entries`,
          metadata: { indexSize: semanticIndex.size() },
        };
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};
