import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Hypothesis {
  id: string;
  description: string;
  status: 'proposed' | 'testing' | 'confirmed' | 'rejected';
  evidence: string[];
  created: number;
}

const hypotheses: Hypothesis[] = [];

export const interactiveDebugTool: ToolInstance = {
  name: 'interactive_debug',
  description: 'Interactive debugging: hypothesis-driven dialogue, experiment suggestion, debugging reports, root cause analysis',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add_hypothesis', 'test_hypothesis', 'confirm', 'reject', 'report', 'suggest_experiments', 'root_cause', 'list'], description: 'Debug action' },
      hypothesis: { type: 'string', description: 'Hypothesis description' },
      hypothesis_id: { type: 'string', description: 'Hypothesis ID' },
      evidence: { type: 'string', description: 'Evidence for/against' },
      error: { type: 'string', description: 'Error message or stack trace' },
      code: { type: 'string', description: 'Relevant code' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'add_hypothesis': {
          const desc = String(params['hypothesis'] ?? '');
          if (!desc) return { success: false, output: '', error: 'hypothesis required' };
          const h: Hypothesis = { id: `hyp-${Date.now()}`, description: desc, status: 'proposed', evidence: [], created: Date.now() };
          hypotheses.push(h);
          return { success: true, output: `Added hypothesis: ${h.id} — ${desc}` };
        }
        case 'test_hypothesis': {
          const id = String(params['hypothesis_id'] ?? '');
          const evidence = String(params['evidence'] ?? '');
          const h = hypotheses.find((x) => x.id === id);
          if (!h) return { success: false, output: '', error: `Hypothesis not found: ${id}` };
          h.status = 'testing';
          if (evidence) h.evidence.push(evidence);
          return { success: true, output: `Testing: ${h.description}\nEvidence: ${evidence || 'none yet'}` };
        }
        case 'confirm': {
          const id = String(params['hypothesis_id'] ?? '');
          const h = hypotheses.find((x) => x.id === id);
          if (!h) return { success: false, output: '', error: `Hypothesis not found: ${id}` };
          h.status = 'confirmed';
          const evidence = String(params['evidence'] ?? '');
          if (evidence) h.evidence.push(evidence);
          return { success: true, output: `Confirmed: ${h.description}` };
        }
        case 'reject': {
          const id = String(params['hypothesis_id'] ?? '');
          const h = hypotheses.find((x) => x.id === id);
          if (!h) return { success: false, output: '', error: `Hypothesis not found: ${id}` };
          h.status = 'rejected';
          const evidence = String(params['evidence'] ?? '');
          if (evidence) h.evidence.push(evidence);
          return { success: true, output: `Rejected: ${h.description}` };
        }
        case 'report': {
          const output = hypotheses.map((h) => `[${h.status.toUpperCase()}] ${h.id}: ${h.description}\n  Evidence: ${h.evidence.join('; ') || 'none'}`).join('\n\n');
          return { success: true, output: output || 'No hypotheses' };
        }
        case 'suggest_experiments': {
          const active = hypotheses.filter((h) => h.status === 'proposed' || h.status === 'testing');
          const suggestions = active.map((h) => {
            const experiments = [
              `Add logging around the suspected area for "${h.description}"`,
              `Write a minimal test case that reproduces the issue`,
              `Check recent changes in git log related to this area`,
              `Run with --verbose flag to get more detail`,
              `Try binary search with git bisect to find when it broke`,
            ];
            return `${h.description}:\n${experiments.map((e) => `  • ${e}`).join('\n')}`;
          });
          return { success: true, output: suggestions.join('\n\n') || 'No active hypotheses to experiment on' };
        }
        case 'root_cause': {
          const error = String(params['error'] ?? '');
          const code = String(params['code'] ?? '');
          if (!error && !code) return { success: false, output: '', error: 'error or code required' };
          const causes: string[] = [];
          if (error.includes('null') || error.includes('undefined')) causes.push('Null/undefined dereference — check for missing null checks');
          if (error.includes('timeout')) causes.push('Timeout — check for deadlocks, infinite loops, or slow I/O');
          if (error.includes('ECONNREFUSED')) causes.push('Connection refused — check if the service is running');
          if (error.includes('ENOSPC')) causes.push('Disk full — check available space');
          if (error.includes('ENOMEM')) causes.push('Out of memory — check for memory leaks');
          if (code.includes('async') && !code.includes('await')) causes.push('Missing await on async call');
          if (causes.length === 0) causes.push('Manual investigation needed — check stack trace and recent changes');
          return { success: true, output: `Root cause analysis:\n${causes.map((c) => `• ${c}`).join('\n')}` };
        }
        case 'list': {
          const output = hypotheses.map((h) => `[${h.status}] ${h.id}: ${h.description}`).join('\n');
          return { success: true, output: output || 'No hypotheses' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Debug failed: ${e}` };
    }
  },
};
