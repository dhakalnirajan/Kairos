import type { ToolInstance, ToolContext, ToolResult } from '../../../types/tools.ts';

const PRIVATE_IPS = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|fc00:|fe80:)/i;
const DEFAULT_TIMEOUT = 30_000;
const MAX_TIMEOUT = 120_000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

function assertSafeUrl(url: string): void {
  const parsed = new URL(url);
  if (PRIVATE_IPS.test(parsed.hostname)) {
    throw new Error(`SSRF blocked: ${parsed.hostname} is a private/internal host`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`SSRF blocked: unsupported protocol ${parsed.protocol}`);
  }
}

function buildAcceptHeader(format: string): string {
  switch (format) {
    case 'markdown':
      return 'text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1';
    case 'text':
      return 'text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1';
    case 'html':
      return 'text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, */*;q=0.1';
    default:
      return 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8';
  }
}

function htmlToMarkdown(html: string): string {
  let md = html;
  // Remove script, style, noscript, meta, link blocks
  md = md.replace(/<(script|style|noscript|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '');
  md = md.replace(/<(script|style|noscript|meta|link)[^>]*\/?>/gi, '');
  // Convert headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  md = md.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
  // Convert formatting
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, code) => `\n\`\`\`\n${code.replace(/<[^>]+>/g, '').trim()}\n\`\`\`\n`);
  // Convert links and images
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  // Convert lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?[uo]l[^>]*>/gi, '\n');
  // Convert blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, text) => text.split('\n').map((l: string) => `> ${l}`).join('\n'));
  // Convert line breaks and paragraphs
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n');
  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  // Collapse whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();
  return md;
}

function extractTextFromHTML(html: string): string {
  // Simple HTML→text: strip tags, decode entities, collapse whitespace
  let text = html;
  text = text.replace(/<(script|style|noscript|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<(script|style|noscript|iframe|object|embed)[^>]*\/?>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

export const httpFetchTool: ToolInstance = {
  name: 'http_fetch',
  description: 'Fetch content from a URL with SSRF protection, Cloudflare bypass, and format conversion. Returns markdown by default.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      format: { type: 'string', enum: ['text', 'markdown', 'html'], description: 'Response format (default: markdown)' },
      timeout: { type: 'number', description: 'Timeout in seconds (max 120, default 30)' },
    },
    required: ['url'],
  },
  riskLevel: 'network',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const url = String(params['url'] ?? '');
    const format = String(params['format'] ?? 'markdown');
    const timeout = Math.min((Number(params['timeout']) || DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT);

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, output: '', error: 'URL must start with http:// or https://' };
    }

    try {
      assertSafeUrl(url);
    } catch (e) {
      return { success: false, output: '', error: String(e) };
    }

    const acceptHeader = buildAcceptHeader(format);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'Accept': acceptHeader,
      'Accept-Language': 'en-US,en;q=0.9',
    };

    try {
      let res: Response;

      try {
        res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout), redirect: 'follow' });
      } catch (e) {
        return { success: false, output: '', error: `Request failed: ${e}` };
      }

      // Cloudflare bypass: retry with honest UA on 403 + challenge
      if (res.status === 403 && res.headers.get('cf-mitigated') === 'challenge') {
        try {
          res = await fetch(url, {
            headers: { ...headers, 'User-Agent': 'kairos' },
            signal: AbortSignal.timeout(timeout),
            redirect: 'follow',
          });
        } catch (e) {
          return { success: false, output: '', error: `Cloudflare bypass failed: ${e}` };
        }
      }

      if (!res.ok) {
        return { success: false, output: '', error: `HTTP ${res.status}: ${res.statusText}` };
      }

      // SSRF check on redirect target
      const finalUrl = res.url;
      if (finalUrl !== url) {
        try {
          assertSafeUrl(finalUrl);
        } catch (e) {
          return { success: false, output: '', error: String(e) };
        }
      }

      // Check content length
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        return { success: false, output: '', error: 'Response too large (exceeds 5MB limit)' };
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        return { success: false, output: '', error: 'Response too large (exceeds 5MB limit)' };
      }

      const contentType = res.headers.get('content-type') ?? '';
      const mime = contentType.split(';')[0]?.trim().toLowerCase() ?? '';

      // Image detection
      if (mime.startsWith('image/')) {
        const base64 = Buffer.from(buffer).toString('base64');
        return {
          success: true,
          output: `[Image: ${mime}, ${buffer.byteLength} bytes]`,
          metadata: { url: finalUrl, contentType: mime, base64: `data:${mime};base64,${base64}` },
        };
      }

      const content = new TextDecoder().decode(buffer);
      const title = `${finalUrl} (${contentType})`;

      let output: string;
      switch (format) {
        case 'markdown':
          output = contentType.includes('text/html') ? htmlToMarkdown(content) : content;
          break;
        case 'text':
          output = contentType.includes('text/html') ? extractTextFromHTML(content) : content;
          break;
        case 'html':
        default:
          output = content;
          break;
      }

      // Truncate if too long
      const maxLen = 32000;
      if (output.length > maxLen) {
        output = output.slice(0, 16000) + '\n[... TRUNCATED ...]\n' + output.slice(-8000);
      }

      return { success: true, output, metadata: { url: finalUrl, status: res.status, contentType, format, title } };
    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError';
      return { success: false, output: '', error: isAbort ? `Request timed out after ${timeout}ms` : `Fetch failed: ${e}` };
    }
  },
};
