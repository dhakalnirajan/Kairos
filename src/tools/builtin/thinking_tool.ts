import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { thinkingTransparency } from '../ux/thinking.ts';

export const thinkingTool: ToolInstance = {
  name: 'thinking',
  description: 'Chain-of-thought transparency: record reasoning steps, visualize thought chains',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start_chain', 'add_step', 'end_chain', 'get_current', 'list_chains', 'format', 'clear'],
        description: 'Thinking action',
      },
      chain_id: { type: 'string', description: 'Chain ID for start_chain' },
      step_type: { type: 'string', enum: ['thought', 'action', 'observation', 'reflection'], description: 'Step type' },
      content: { type: 'string', description: 'Step content' },
      chainId: { type: 'string', description: 'Chain ID to format' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'start_chain': {
          const chain = thinkingTransparency.startChain(params.chain_id ? String(params.chain_id) : undefined);
          return { success: true, output: `Started thinking chain: ${chain.id}` };
        }
        case 'add_step': {
          const stepType = String(params['step_type'] ?? 'thought') as 'thought' | 'action' | 'observation' | 'reflection';
          const content = String(params['content'] ?? '');
          if (!content) return { success: false, output: '', error: 'content required' };
          const step = thinkingTransparency.addStep(stepType, content);
          return step
            ? { success: true, output: `Added ${stepType}: ${content}` }
            : { success: false, output: '', error: 'No active chain. Start one first.' };
        }
        case 'end_chain': {
          const chain = thinkingTransparency.endChain();
          return chain
            ? { success: true, output: `Ended chain ${chain.id} with ${chain.steps.length} steps`, metadata: { id: chain.id, steps: chain.steps.length } }
            : { success: false, output: '', error: 'No active chain' };
        }
        case 'get_current': {
          const current = thinkingTransparency.getCurrentChain();
          return current
            ? { success: true, output: `Active chain: ${current.id} (${current.steps.length} steps)` }
            : { success: true, output: 'No active chain' };
        }
        case 'list_chains': {
          const chains = thinkingTransparency.getAllChains();
          const output = chains.map((c) => `${c.id}: ${c.steps.length} steps${c.endTime ? ' (complete)' : ' (active)'}`).join('\n');
          return { success: true, output: output || 'No chains recorded', metadata: { count: chains.length } };
        }
        case 'format': {
          const chainId = String(params['chainId'] ?? '');
          const chains = thinkingTransparency.getAllChains();
          const target = chainId ? chains.find((c) => c.id === chainId) : chains[chains.length - 1];
          return target
            ? { success: true, output: thinkingTransparency.formatChain(target) }
            : { success: false, output: '', error: `Chain not found: ${chainId}` };
        }
        case 'clear': {
          thinkingTransparency.clear();
          return { success: true, output: 'All chains cleared' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Thinking tool failed: ${e}` };
    }
  },
};
