import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { MemoryDatabase } from '../../memory/database.ts';
import { getDbPath } from '../../utils/paths.ts';

let db: MemoryDatabase | null = null;
function getDb(): MemoryDatabase {
  if (!db) db = new MemoryDatabase(getDbPath());
  return db;
}

interface PreferenceRule {
  id: string;
  pattern: string;
  replacement: string;
  context: string;
  confidence: number;
  created: number;
  hits: number;
}

const rules: PreferenceRule[] = [];

export const learningTool: ToolInstance = {
  name: 'learning',
  description: 'Learning from corrections: store preference rules, pattern matching, apply learned preferences',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add_rule', 'list_rules', 'match', 'apply', 'remove', 'stats'], description: 'Learning action' },
      pattern: { type: 'string', description: 'Pattern to match' },
      replacement: { type: 'string', description: 'Replacement or correction' },
      context: { type: 'string', description: 'Context where rule applies' },
      rule_id: { type: 'string', description: 'Rule ID' },
      input: { type: 'string', description: 'Input to match against rules' },
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
        case 'add_rule': {
          const pattern = String(params['pattern'] ?? '');
          const replacement = String(params['replacement'] ?? '');
          const context = String(params['context'] ?? 'general');
          if (!pattern || !replacement) return { success: false, output: '', error: 'pattern and replacement required' };
          const rule: PreferenceRule = { id: `rule-${Date.now()}`, pattern, replacement, context, confidence: 1.0, created: Date.now(), hits: 0 };
          rules.push(rule);
          memory.insertWorkflowMemory({ type: 'preference', key: rule.id, value: JSON.stringify(rule), confidence: 1.0 });
          return { success: true, output: `Added rule: "${pattern}" → "${replacement}" (${context})` };
        }
        case 'list_rules': {
          const output = rules.map((r) => `[${r.id}] "${r.pattern}" → "${r.replacement}" (${r.context}, confidence: ${r.confidence}, hits: ${r.hits})`).join('\n');
          return { success: true, output: output || 'No rules', metadata: { count: rules.length } };
        }
        case 'match': {
          const input = String(params['input'] ?? '');
          if (!input) return { success: false, output: '', error: 'input required' };
          const matches = rules.filter((r) => input.toLowerCase().includes(r.pattern.toLowerCase()));
          const output = matches.map((m) => `"${m.pattern}" → "${m.replacement}" (${m.context})`).join('\n');
          return { success: true, output: output || 'No matching rules', metadata: { count: matches.length } };
        }
        case 'apply': {
          const input = String(params['input'] ?? '');
          if (!input) return { success: false, output: '', error: 'input required' };
          let result = input;
          let applied = 0;
          for (const rule of rules) {
            if (result.toLowerCase().includes(rule.pattern.toLowerCase())) {
              const regex = new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              result = result.replace(regex, rule.replacement);
              rule.hits++;
              applied++;
            }
          }
          return { success: true, output: applied > 0 ? `Applied ${applied} rules:\n${result}` : 'No rules matched', metadata: { applied } };
        }
        case 'remove': {
          const ruleId = String(params['rule_id'] ?? '');
          if (!ruleId) return { success: false, output: '', error: 'rule_id required' };
          const idx = rules.findIndex((r) => r.id === ruleId);
          if (idx === -1) return { success: false, output: '', error: `Rule not found: ${ruleId}` };
          rules.splice(idx, 1);
          return { success: true, output: `Removed rule: ${ruleId}` };
        }
        case 'stats': {
          const totalHits = rules.reduce((sum, r) => sum + r.hits, 0);
          return { success: true, output: `Rules: ${rules.length}, Total hits: ${totalHits}`, metadata: { rules: rules.length, totalHits } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Learning failed: ${e}` };
    }
  },
};
