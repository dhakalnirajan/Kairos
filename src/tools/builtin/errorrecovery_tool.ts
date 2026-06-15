import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

interface RetryPolicy {
  name: string;
  maxRetries: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableErrors: string[];
}

const DEFAULT_POLICIES: RetryPolicy[] = [
  { name: 'network', maxRetries: 3, backoffMs: 1000, maxBackoffMs: 30000, retryableErrors: ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'fetch failed'] },
  { name: 'rate_limit', maxRetries: 5, backoffMs: 2000, maxBackoffMs: 60000, retryableErrors: ['429', 'rate limit', 'too many requests'] },
  { name: 'transient', maxRetries: 2, backoffMs: 500, maxBackoffMs: 5000, retryableErrors: ['502', '503', '504', 'temporary'] },
  { name: 'auth', maxRetries: 1, backoffMs: 0, maxBackoffMs: 0, retryableErrors: ['401', '403', 'unauthorized'] },
];

const retryHistory: Array<{ policy: string; error: string; attempt: number; timestamp: number; resolved: boolean }> = [];

export const errorRecoveryTool: ToolInstance = {
  name: 'error_recovery',
  description: 'Strategic error recovery: classified retry policies, exponential backoff, prompt rewriting on failure',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['classify', 'should_retry', 'get_backoff', 'log_error', 'history', 'suggest_prompt_rewrite', 'policies'], description: 'Recovery action' },
      error: { type: 'string', description: 'Error message' },
      attempt: { type: 'number', description: 'Current attempt number' },
      policy: { type: 'string', description: 'Policy name' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'classify': {
          const error = String(params['error'] ?? '');
          const errorLower = error.toLowerCase();
          if (errorLower.includes('econnrefused') || errorLower.includes('econnreset') || errorLower.includes('timeout')) return { success: true, output: 'network' };
          if (errorLower.includes('429') || errorLower.includes('rate limit')) return { success: true, output: 'rate_limit' };
          if (errorLower.includes('401') || errorLower.includes('403')) return { success: true, output: 'auth' };
          if (errorLower.includes('502') || errorLower.includes('503')) return { success: true, output: 'transient' };
          if (errorLower.includes('oom') || errorLower.includes('memory')) return { success: true, output: 'resource' };
          return { success: true, output: 'unknown' };
        }
        case 'should_retry': {
          const error = String(params['error'] ?? '');
          const attempt = Number(params['attempt'] ?? 1);
          const classifyResult = await this.execute({ action: 'classify', error }, _ctx);
          const policyName = classifyResult.output;
          const policies: Record<string, { max: number; backoff: number }> = {
            network: { max: 3, backoff: 1000 },
            rate_limit: { max: 5, backoff: 2000 },
            transient: { max: 2, backoff: 500 },
            auth: { max: 1, backoff: 0 },
            resource: { max: 1, backoff: 5000 },
            unknown: { max: 0, backoff: 0 },
          };
          const p = policies[policyName] ?? policies.unknown!;
          const shouldRetry = attempt <= p.max;
          const backoffMs = p.backoff * Math.pow(2, attempt - 1);
          return { success: true, output: shouldRetry ? `Retry in ${backoffMs}ms` : 'Do not retry', metadata: { shouldRetry, backoffMs, maxAttempts: p.max } };
        }
        case 'get_backoff': {
          const attempt = Number(params['attempt'] ?? 1);
          const baseMs = 1000;
          const backoffMs = baseMs * Math.pow(2, attempt - 1);
          return { success: true, output: `${backoffMs}ms`, metadata: { backoffMs } };
        }
        case 'log_error': {
          const error = String(params['error'] ?? '');
          const policy = String(params['policy'] ?? 'unknown');
          const attempt = Number(params['attempt'] ?? 1);
          retryHistory.push({ policy, error, attempt, timestamp: Date.now(), resolved: false });
          return { success: true, output: `Logged error: ${error}` };
        }
        case 'history': {
          const output = retryHistory.map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.policy}: ${e.error.slice(0, 80)} (attempt ${e.attempt})`).join('\n');
          return { success: true, output: output || 'No error history', metadata: { count: retryHistory.length } };
        }
        case 'suggest_prompt_rewrite': {
          const error = String(params['error'] ?? '');
          const suggestions: string[] = [];
          if (error.includes('timeout')) suggestions.push('Add explicit timeout parameter');
          if (error.includes('token')) suggestions.push('Refresh or regenerate tokens');
          if (error.includes('connection')) suggestions.push('Check network connectivity');
          if (error.includes('syntax')) suggestions.push('Validate input format');
          return { success: true, output: suggestions.join('\n') || 'No specific suggestions' };
        }
        case 'policies': {
          const output = DEFAULT_POLICIES.map((p) => `${p.name}: max=${p.maxRetries}, backoff=${p.backoffMs}ms`).join('\n');
          return { success: true, output };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Error recovery failed: ${e}` };
    }
  },
};
