#!/usr/bin/env bun
/**
 * web-search/scripts/run.ts
 *
 * Three-stage pipeline:
 *   1. Search  — Brave Search API or generic configurable backend
 *   2. Fetch   — plain HTTP GET each result URL
 *   3. Summarise — TF-IDF keyword overlap to pick key sentences per page
 *
 * No external dependencies beyond Node/Bun built-ins.
 */

import { parseArgs } from "util";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Backend = "brave" | "generic";

interface SearchArgs {
  query: string;
  count: number;
  sentences: number;
  output?: string;
  backend?: Backend;
  timeoutMs: number;
}

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

interface PageResult {
  rank: number;
  title?: string;
  url: string;
  description?: string;
  status: "ok" | "fetch-failed" | "skipped";
  reason?: string;
  keySentences?: string[];
  relevanceScore?: number;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseCliArgs(): SearchArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      query: { type: "string" },
      count: { type: "string", default: "5" },
      sentences: { type: "string", default: "5" },
      output: { type: "string" },
      backend: { type: "string" },
      "timeout-ms": { type: "string", default: "8000" },
    },
  });

  if (!values.query) {
    console.error("Error: --query is required");
    process.exit(1);
  }
  const count = Math.min(10, Math.max(1, parseInt((values.count as string) ?? "5", 10)));
  const sentences = Math.max(1, parseInt((values.sentences as string) ?? "5", 10));
  const timeoutMs = parseInt((values["timeout-ms"] as string) ?? "8000", 10);

  return {
    query: values.query as string,
    count,
    sentences,
    output: values.output as string | undefined,
    backend: values.backend as Backend | undefined,
    timeoutMs,
  };
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

interface GenericBackendConfig {
  url: string;                        // URL template with {query} and {count} placeholders
  headers?: Record<string, string>;
  resultsPath?: string;               // dot-path to results array in response JSON, e.g. "results"
  titleField?: string;
  urlField?: string;
  descriptionField?: string;
}

interface SkillConfig {
  userAgent?: string;
  genericSearch?: GenericBackendConfig;
}

function loadConfig(): SkillConfig {
  const here = dirname(fileURLToPath(import.meta.url));
  const cfgPath = join(here, "..", "config", "defaults.yaml");
  if (!existsSync(cfgPath)) return {};
  // Minimal YAML key: value parser (no multi-line, no arrays — just what this config needs).
  const raw = readFileSync(cfgPath, "utf-8");
  const cfg: any = {};
  let currentSection: string | null = null;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = line.match(/^([a-zA-Z]+):$/);
    if (sectionMatch) { currentSection = sectionMatch[1]; cfg[currentSection] = {}; continue; }
    const kvMatch = line.match(/^\s{2}([a-zA-Z]+):\s*(.+)$/);
    if (kvMatch && currentSection) {
      cfg[currentSection][kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, "");
    }
  }
  return cfg as SkillConfig;
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*["']?(.+?)["']?\s*$/);
      if (m) env[m[1]] = m[2];
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// Stage 1: Search backends
// ---------------------------------------------------------------------------

async function searchBrave(query: string, count: number, apiKey: string): Promise<SearchResult[]> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&safesearch=moderate`;
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });
  if (!res.ok) {
    throw new Error(`Brave API returned HTTP ${res.status}: ${await res.text()}`);
  }
  const data: any = await res.json();
  const webResults = data?.web?.results ?? [];
  return webResults.slice(0, count).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? r.extra_snippets?.[0] ?? "",
  }));
}

function getNestedField(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

async function searchGeneric(query: string, count: number, cfg: GenericBackendConfig): Promise<SearchResult[]> {
  const url = cfg.url
    .replace("{query}", encodeURIComponent(query))
    .replace("{count}", String(count));

  const res = await fetch(url, { headers: cfg.headers ?? {} });
  if (!res.ok) throw new Error(`Generic search backend returned HTTP ${res.status}`);
  const data: any = await res.json();

  const results: any[] = cfg.resultsPath ? getNestedField(data, cfg.resultsPath) : data;
  if (!Array.isArray(results)) throw new Error("Generic backend response is not an array (check resultsPath in config)");

  return results.slice(0, count).map((r: any) => ({
    title: r[cfg.titleField ?? "title"] ?? "",
    url: r[cfg.urlField ?? "url"] ?? "",
    description: r[cfg.descriptionField ?? "description"] ?? r[cfg.descriptionField ?? "snippet"] ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Stage 2: Fetch page content
// ---------------------------------------------------------------------------

async function fetchPage(url: string, timeoutMs: number, userAgent: string): Promise<{ ok: true; html: string } | { ok: false; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return { ok: false, reason: `Non-HTML content-type: ${contentType}` };
    }
    const html = await res.text();
    return { ok: true, html };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === "AbortError") return { ok: false, reason: `Timeout after ${timeoutMs}ms` };
    return { ok: false, reason: e.message ?? "fetch error" };
  }
}

// ---------------------------------------------------------------------------
// Stage 3: Summarise — strip HTML, score sentences
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    // Remove script, style, nav, footer, header blocks entirely.
    .replace(/<(script|style|nav|footer|header|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    // Remove remaining tags.
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities.
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Collapse whitespace.
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace + capital letter.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 600);
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall", "can", "to", "of", "in", "on", "at", "for", "by", "with", "about", "as", "from", "or", "and", "but", "not", "this", "that", "it", "its"]);
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  );
}

function scoreRelevance(sentence: string, queryTokens: Set<string>): number {
  const sentTokens = tokenize(sentence);
  if (sentTokens.size === 0) return 0;
  let hits = 0;
  for (const t of queryTokens) if (sentTokens.has(t)) hits++;
  return hits / queryTokens.size;
}

function summarisePage(html: string, query: string, maxSentences: number): { keySentences: string[]; relevanceScore: number } {
  const text = stripHtml(html);
  const sentences = splitSentences(text);
  const queryTokens = tokenize(query);

  const scored = sentences
    .map((s) => ({ s, score: scoreRelevance(s, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const keySentences = scored.slice(0, maxSentences).map(({ s }) => s);
  const relevanceScore =
    scored.length > 0
      ? Math.round((scored.slice(0, maxSentences).reduce((sum, { score }) => sum + score, 0) / Math.min(maxSentences, scored.length)) * 100) / 100
      : 0;

  return { keySentences, relevanceScore };
}

// ---------------------------------------------------------------------------
// Markdown report
// ---------------------------------------------------------------------------

function buildMarkdownReport(query: string, results: PageResult[]): string {
  const lines: string[] = [`# Web Search Results`, ``, `**Query:** ${query}`, `**Retrieved:** ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, ``];

  for (const r of results) {
    lines.push(`## Result ${r.rank}: ${r.title ?? r.url}`);
    lines.push(`**URL:** ${r.url}`);
    if (r.description) lines.push(`**Description:** ${r.description}`);
    lines.push("");
    if (r.status === "ok" && r.keySentences && r.keySentences.length > 0) {
      lines.push(`**Key Sentences** (relevance: ${r.relevanceScore}):`);
      for (const s of r.keySentences) lines.push(`- ${s}`);
    } else if (r.status !== "ok") {
      lines.push(`_Fetch failed: ${r.reason}_`);
    } else {
      lines.push(`_No query-relevant sentences extracted._`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs();
  const cfg = loadConfig();
  const envVars = { ...process.env, ...loadEnv() };

  const userAgent = cfg.userAgent ?? "harness-web-search/1.0";

  // Resolve backend.
  let backend: Backend;
  if (args.backend) {
    backend = args.backend;
  } else if (envVars.BRAVE_SEARCH_API_KEY) {
    backend = "brave";
  } else if (cfg.genericSearch?.url) {
    backend = "generic";
  } else {
    console.error(
      JSON.stringify(
        {
          error: "no-backend",
          message:
            "No search backend available. Set BRAVE_SEARCH_API_KEY in your environment (.env or shell) to use Brave Search, or configure genericSearch.url in config/defaults.yaml.",
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // Stage 1: search.
  let searchResults: SearchResult[];
  try {
    if (backend === "brave") {
      searchResults = await searchBrave(args.query, args.count, envVars.BRAVE_SEARCH_API_KEY!);
    } else {
      if (!cfg.genericSearch?.url) {
        console.error(JSON.stringify({ error: "no-generic-config", message: "genericSearch.url is not set in config/defaults.yaml" }, null, 2));
        process.exit(1);
      }
      searchResults = await searchGeneric(args.query, args.count, cfg.genericSearch);
    }
  } catch (e: any) {
    console.error(JSON.stringify({ error: "search-failed", message: e.message }, null, 2));
    process.exit(1);
  }

  if (searchResults.length === 0) {
    console.log(JSON.stringify([], null, 2));
    return;
  }

  // Stages 2 + 3: fetch and summarise each result concurrently.
  const pageResults: PageResult[] = await Promise.all(
    searchResults.map(async (result, idx): Promise<PageResult> => {
      const base = { rank: idx + 1, title: result.title, url: result.url, description: result.description };
      const fetched = await fetchPage(result.url, args.timeoutMs, userAgent);
      if (!fetched.ok) {
        return { ...base, status: "fetch-failed", reason: fetched.reason };
      }
      const { keySentences, relevanceScore } = summarisePage(fetched.html, args.query, args.sentences);
      return { ...base, status: "ok", keySentences, relevanceScore };
    })
  );

  // Sort: ok results first (preserving rank order within each group), failed last.
  pageResults.sort((a, b) => {
    if (a.status === b.status) return a.rank - b.rank;
    return a.status === "ok" ? -1 : 1;
  });

  console.log(JSON.stringify(pageResults, null, 2));

  if (args.output) {
    const md = buildMarkdownReport(args.query, pageResults);
    writeFileSync(args.output, md, "utf-8");
    console.error(`Markdown report written to ${args.output}`);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: "unexpected", message: e.message }, null, 2));
  process.exit(1);
});
