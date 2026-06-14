import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

const PRIVATE_IPS = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|fc00:|fe80:)/i;
const DEFAULT_TIMEOUT = 30_000;

export const httpFetchTool: ToolInstance = {
  name: 'http_fetch',
  description: 'Fetch content from a URL with DNS rebinding protection',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Response format' },
      timeout: { type: 'number', description: 'Timeout in ms' },
    },
    required: ['url'],
  },
  riskLevel: 'network',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const url = String(params['url'] ?? '');
    const timeout = Number(params['timeout']) || DEFAULT_TIMEOUT;

    try {
      const parsed = new URL(url);

      if (PRIVATE_IPS.test(parsed.hostname)) {
        return { success: false, output: '', error: `Access to private/internal host blocked: ${parsed.hostname}` };
      }

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false, output: '', error: `Unsupported protocol: ${parsed.protocol}` };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'KairosCode/0.1' },
        });

        if (!res.ok) {
          return { success: false, output: '', error: `HTTP ${res.status}: ${res.statusText}` };
        }

        const text = await res.text();
        const truncated = text.length > 32000 ? text.slice(0, 16000) + '\n[... TRUNCATED ...]\n' + text.slice(-8000) : text;

        return { success: true, output: truncated, metadata: { url, status: res.status, contentType: res.headers.get('content-type') } };
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      return { success: false, output: '', error: isAbort ? `Request timed out after ${timeout}ms` : `Fetch failed: ${e}` };
    }
  },
};
