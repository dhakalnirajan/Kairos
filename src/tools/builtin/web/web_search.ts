import type { ToolInstance, ToolContext, ToolResult } from '../../../types/tools.ts';

const PRIVATE_IPS = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|fc00:|fe80:)/i;

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Brave Search API
// ---------------------------------------------------------------------------

async function searchBrave(query: string, limit: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brave API error: ${res.status}`);
  const data = await res.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
  return (data.web?.results ?? []).map(r => ({ title: r.title, url: r.url, snippet: r.description }));
}

// ---------------------------------------------------------------------------
// DuckDuckGo HTML scraping (no API key needed)
// ---------------------------------------------------------------------------

async function searchDuckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetch(searchUrl, {
    headers: { 'User-Agent': 'KairosCode/0.1' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo error: ${res.status}`);
  const html = await res.text();
  const results: SearchResult[] = [];
  const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/g;
  let match;
  while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
    results.push({ title: stripHtml(match[2] ?? ''), url: extractUrl(match[1] ?? ''), snippet: stripHtml(match[3] ?? '') });
  }
  if (results.length === 0) {
    const fallbackPattern = /<h2[^>]*>.*?<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g;
    while ((match = fallbackPattern.exec(html)) !== null && results.length < limit) {
      const url = extractUrl(match[1] ?? '');
      if (url.startsWith('http')) results.push({ title: stripHtml(match[2] ?? ''), url, snippet: '' });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Mimo API — Xiaomi's web search via SSE streaming annotations
// ---------------------------------------------------------------------------

interface MimoAnnotation {
  type?: string | null;
  url?: string | null;
  title?: string | null;
  summary?: string | null;
  site_name?: string | null;
  publish_time?: string | null;
}

function parseMimoSseLine(line: string): MimoAnnotation[] | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const frame = JSON.parse(payload);
    const choice = frame.choices?.[0];
    const annotations = choice?.delta?.annotations ?? choice?.message?.annotations;
    return annotations && annotations.length > 0 ? annotations : null;
  } catch {
    return null;
  }
}

function formatMimoAnnotations(annotations: MimoAnnotation[]): string {
  const lines = annotations.flatMap(a => {
    if (!a.url) return [];
    const head = [a.title, a.site_name, a.publish_time].filter(Boolean).join(' · ');
    return [`- ${head || a.url}`, `  ${a.url}`, ...(a.summary ? [`  ${a.summary}`] : [])];
  });
  return lines.length > 0 ? lines.join('\n') : '';
}

async function searchMimo(
  query: string,
  limit: number,
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<SearchResult[]> {
  const base = baseUrl.replace(/\/+$/, '');
  const url = base.endsWith('/chat/completions') ? base : (base.endsWith('/v1') ? base : `${base}/v1`) + '/chat/completions';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: query }],
        tools: [{ type: 'web_search', max_keyword: 3, force_search: true, limit }],
        max_completion_tokens: 256,
        temperature: 1.0,
        top_p: 0.95,
        stream: true,
        thinking: { type: 'disabled' },
      }),
      signal: controller.signal,
    });

    if (res.status === 409) {
      throw new Error('Mimo web search quota exceeded');
    }
    if (!res.ok) {
      throw new Error(`Mimo API error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let found: MimoAnnotation[] | null = null;

    while (!found) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const annotations = parseMimoSseLine(line);
        if (annotations) {
          found = annotations;
          break;
        }
      }
    }

    reader.cancel();

    if (!found || found.length === 0) {
      return [];
    }

    return found.filter(a => a.url).map(a => ({
      title: a.title ?? '',
      url: a.url ?? '',
      snippet: a.summary ?? '',
    }));
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Exa MCP — Universal search via mcp.exa.ai
// ---------------------------------------------------------------------------

async function searchExa(
  query: string,
  limit: number,
  apiKey: string | undefined,
  searchType: string,
  livecrawl: string,
  contextMaxCharacters: number | undefined,
): Promise<SearchResult[]> {
  const baseUrl = apiKey
    ? `https://mcp.exa.ai/mcp?exaApiKey=${encodeURIComponent(apiKey)}`
    : 'https://mcp.exa.ai/mcp';

  const args: Record<string, unknown> = {
    query,
    type: searchType,
    numResults: limit,
    livecrawl,
  };
  if (contextMaxCharacters) args.contextMaxCharacters = contextMaxCharacters;

  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'web_search_exa', arguments: args },
  });

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body,
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`Exa MCP error: ${res.status}`);

  const text = await res.text();
  // Parse SSE response for result
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    try {
      const data = JSON.parse(line.slice(6));
      const content = data.result?.content?.[0]?.text;
      if (content) {
        // Exa returns content as a structured string, parse it into results
        return parseExaContent(content);
      }
    } catch { /* skip malformed lines */ }
  }

  // Fallback: try parsing as plain JSON
  try {
    const data = JSON.parse(text);
    const content = data.result?.content?.[0]?.text;
    if (content) return parseExaContent(content);
  } catch { /* not JSON */ }

  return [];
}

function parseExaContent(content: string): SearchResult[] {
  // Exa returns results as text blocks with URLs
  const results: SearchResult[] = [];
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  let match;
  const seen = new Set<string>();

  // Split by common delimiters
  const chunks = content.split(/\n\n+/);
  for (const chunk of chunks) {
    const urls = chunk.match(urlPattern) ?? [];
    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      // Try to extract title and snippet from surrounding text
      const lines = chunk.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^[-*]\s*/, '').trim() ?? '';
      const snippet = lines.slice(1).join(' ').trim() ?? '';
      results.push({ title: title.slice(0, 200), url, snippet: snippet.slice(0, 500) });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Page content fetcher
// ---------------------------------------------------------------------------

async function fetchPageContent(url: string, timeout: number, maxLen: number): Promise<string> {
  try {
    const parsed = new URL(url);
    if (PRIVATE_IPS.test(parsed.hostname)) return '[blocked: private host]';
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '[blocked: non-http protocol]';

    const res = await fetch(url, {
      headers: { 'User-Agent': 'KairosCode/0.1' },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return `[HTTP ${res.status}]`;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return `[binary content: ${contentType}]`;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.slice(0, maxLen) + ' [...truncated]' : text;
  } catch {
    return '[fetch failed]';
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
}

function extractUrl(href: string): string {
  const uddg = href.match(/uddg=([^&]+)/);
  if (uddg) return decodeURIComponent(uddg[1] ?? '');
  return href;
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const webSearchTool: ToolInstance = {
  name: 'web_search',
  description: 'Search the web with multiple backends: Mimo API (Xiaomi), Exa MCP (universal), Brave Search API, or DuckDuckGo. Falls back automatically. Set fetchContent=true to retrieve and extract text from top results.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Number of results (default 5)' },
      fetchContent: { type: 'boolean', description: 'Fetch and extract text content from top results (default: false)' },
      fetchLimit: { type: 'number', description: 'Max results to fetch content for when fetchContent=true (default: 3)' },
      backend: { type: 'string', enum: ['auto', 'mimo', 'exa', 'brave', 'duckduckgo'], description: 'Force a specific backend (default: auto — follows config)' },
    },
    required: ['query'],
  },
  riskLevel: 'network',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const query = String(params['query'] ?? '');
    const cfg = ctx.config as Record<string, unknown> | undefined;
    const webSearchCfg = cfg?.webSearch as Record<string, unknown> | undefined;
    const limit = Number(params['limit']) || Number(webSearchCfg?.maxResults) || 5;
    const fetchContent = Boolean(params['fetchContent']) || Boolean(webSearchCfg?.fetchContent) || false;
    const fetchLimit = Number(params['fetchLimit']) || 3;
    const fetchTimeout = Number(webSearchCfg?.fetchTimeout) || 10000;
    const maxContentLength = Number(webSearchCfg?.maxContentLength) || 8000;

    if (!query) return { success: false, output: '', error: 'Query is required' };

    const mimoApiKey = String(webSearchCfg?.mimoApiKey || process.env.MIMO_API_KEY || '');
    const mimoBaseUrl = String(webSearchCfg?.mimoBaseUrl || 'https://api.xiaomimimo.com/v1');
    const mimoModel = String(webSearchCfg?.mimoModel || 'mimo-v2.5');
    const exaApiKey = String(webSearchCfg?.exaApiKey || process.env.EXA_API_KEY || '');
    const braveApiKey = String(webSearchCfg?.braveApiKey || process.env.BRAVE_API_KEY || '');
    const searchType = String(webSearchCfg?.searchType || 'auto');
    const livecrawl = String(webSearchCfg?.livecrawl || 'fallback');
    const contextMaxCharacters = Number(webSearchCfg?.contextMaxCharacters) || undefined;
    const forcedBackend = String(params['backend'] || '');

    // Resolve provider: forced > config > auto-detect
    let provider = forcedBackend || String(webSearchCfg?.provider || '');
    if (!provider || provider === 'auto') {
      if (mimoApiKey) provider = 'mimo';
      else if (exaApiKey) provider = 'exa';
      else if (braveApiKey) provider = 'brave';
      else provider = 'duckduckgo';
    }

    let results: SearchResult[];
    let usedProvider: string;

    // Try primary, then fallback chain
    const tryMimo = async () => {
      if (!mimoApiKey) throw new Error('No MIMO_API_KEY');
      return searchMimo(query, limit, mimoApiKey, mimoBaseUrl, mimoModel);
    };
    const tryExa = async () => searchExa(query, limit, exaApiKey || undefined, searchType, livecrawl, contextMaxCharacters);
    const tryBrave = async () => {
      if (!braveApiKey) throw new Error('No BRAVE_API_KEY');
      return searchBrave(query, limit, braveApiKey);
    };
    const tryDuckDuckGo = () => searchDuckDuckGo(query, limit);

    const fallbacks: Record<string, { fn: () => Promise<SearchResult[]>; name: string; fallback: string }> = {
      mimo: { fn: tryMimo, name: 'mimo', fallback: 'exa' },
      exa: { fn: tryExa, name: 'exa', fallback: 'brave' },
      brave: { fn: tryBrave, name: 'brave', fallback: 'duckduckgo' },
      duckduckgo: { fn: tryDuckDuckGo, name: 'duckduckgo', fallback: '' },
    };

    const getEntry = (name: string) => fallbacks[name] ?? fallbacks.duckduckgo!;

    try {
      const entry = getEntry(provider);
      results = await entry.fn();
      usedProvider = entry.name;
    } catch (primaryErr) {
      const entry = getEntry(provider);
      const fbName = entry.fallback;
      const fb = fbName ? fallbacks[fbName] : undefined;
      if (fb) {
        try {
          results = await fb.fn();
          usedProvider = `${fb.name} (fallback)`;
        } catch {
          return { success: false, output: '', error: `Search failed: ${primaryErr}` };
        }
      } else {
        return { success: false, output: '', error: `Search failed: ${primaryErr}` };
      }
    }

    if (results.length === 0) {
      return { success: true, output: 'No results found', metadata: { query, provider: usedProvider, count: 0 } };
    }

    let output = results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n');

    if (fetchContent && results.length > 0) {
      const toFetch = results.slice(0, fetchLimit);
      const pages = await Promise.all(toFetch.map(r => fetchPageContent(r.url, fetchTimeout, maxContentLength)));
      output += '\n\n--- Page Content ---\n\n';
      for (let i = 0; i < toFetch.length; i++) {
        output += `### ${toFetch[i]!.title}\n${toFetch[i]!.url}\n\n${pages[i] ?? ''}\n\n`;
      }
    }

    return {
      success: true,
      output,
      metadata: { query, provider: usedProvider, count: results.length, fetchContent },
    };
  },
};
