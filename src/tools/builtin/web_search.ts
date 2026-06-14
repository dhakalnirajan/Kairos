import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export const webSearchTool: ToolInstance = {
  name: 'web_search',
  description: 'Search the web using a search engine API',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Number of results (default 5)' },
    },
    required: ['query'],
  },
  riskLevel: 'network',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const query = String(params['query'] ?? '');
    const limit = Number(params['limit']) || 5;

    if (!query) {
      return { success: false, output: '', error: 'Query is required' };
    }

    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(searchUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'KairosCode/0.1' },
        });

        if (!res.ok) {
          return { success: false, output: '', error: `Search failed: HTTP ${res.status}` };
        }

        const html = await res.text();
        const results: Array<{ title: string; url: string; snippet: string }> = [];

        const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;
        let match;

        while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
          results.push({
            title: stripHtml(match[2] ?? ''),
            url: extractUrl(match[1] ?? ''),
            snippet: stripHtml(match[3] ?? ''),
          });
        }

        if (results.length === 0) {
          const fallbackPattern = /<h2[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
          while ((match = fallbackPattern.exec(html)) !== null && results.length < limit) {
            const url = extractUrl(match[1] ?? '');
            if (url.startsWith('http')) {
              results.push({ title: stripHtml(match[2] ?? ''), url, snippet: '' });
            }
          }
        }

        const output = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n');
        return { success: true, output: output || 'No results found', metadata: { query, count: results.length } };
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      return { success: false, output: '', error: `Search failed: ${e}` };
    }
  },
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
}

function extractUrl(href: string): string {
  const uddg = href.match(/uddg=([^&]+)/);
  if (uddg) return decodeURIComponent(uddg[1] ?? '');
  return href;
}
