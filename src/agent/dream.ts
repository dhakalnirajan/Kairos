import type { MemoryDatabase } from '../memory/database.ts';
import type { LLMClient, ChatMessage } from '../llm/client.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import { estimateTokens } from '../utils/tokenizer.ts';

export class DreamEngine {
  private memory: MemoryDatabase;
  private llm: LLMClient;
  private config: KairosConfigOutput;

  constructor(memory: MemoryDatabase, llm: LLMClient, config: KairosConfigOutput) {
    this.memory = memory;
    this.llm = llm;
    this.config = config;
  }

  async consolidate(): Promise<{ factsExtracted: number; factsStored: number }> {
    const sessions = this.memory.getAllSessions();
    let factsExtracted = 0;
    let factsStored = 0;

    for (const session of sessions) {
      const history = this.memory.getConversationHistory(session.id, 100);
      if (history.length === 0) continue;

      const conversation = history.map((h) => `${h.role}: ${h.content}`).join('\n');

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'Extract key facts, decisions, and preferences from this conversation. Return each fact on a new line prefixed with either [decision], [preference], or [fact]. Be concise.',
        },
        { role: 'user', content: conversation.slice(0, 8000) },
      ];

      try {
        const result = await this.llm.chat(messages, {
          maxTokens: 2048,
          temperature: 0.3,
        });

        const lines = result.content.split('\n').filter((l) => l.trim());
        for (const line of lines) {
          const typeMatch = line.match(/^\[(decision|preference|pattern)\]\s*(.+)/i);
          if (typeMatch) {
            const type = typeMatch[1]?.toLowerCase() as 'decision' | 'preference' | 'pattern';
            const fact = typeMatch[2]?.trim() ?? '';
            if (fact.length > 5) {
              this.memory.insertTopicFact({ topic: session.title || 'general', fact, embedding: null });
              factsStored++;
            }
            factsExtracted++;
          }
        }
      } catch {
        continue;
      }
    }

    return { factsExtracted, factsStored };
  }

  async enforceTTL(): Promise<number> {
    const sessions = this.memory.getAllSessions();
    const ttlMs = (this.config.memory.ttlDays || 30) * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    let deleted = 0;

    for (const session of sessions) {
      if (session.updatedAt < cutoff) {
        this.memory.deleteConversationHistory(session.id);
        this.memory.deleteSession(session.id);
        deleted++;
      }
    }

    return deleted;
  }
}
