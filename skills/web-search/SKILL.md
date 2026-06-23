---
name: "web-search"
version: "1.0.0"
description: "Searches the web via Brave Search API (or a configurable generic backend), fetches the top N result pages, and extracts key facts per page into a structured summary"
author: "harness-core"
category: "automation"
tools:
  - bash
  - http_fetch
  - write_file
permissions:
  - allow: [http_fetch]
  - ask: [bash, write_file]
dependencies:
  bun: ">=1.1.0"
  packages: []
entrypoint: "scripts/run.ts"
---

## Purpose

`web-search` runs a full three-stage pipeline in one invocation: it
submits a query to a search API, fetches the full HTML content of the top
N results, strips markup to extract readable text, and summarises each
page into a structured finding (title, URL, key sentences, relevance
score relative to the query). The final output is a ranked JSON array of
per-page summaries — not raw search snippets — giving downstream skills
or agents substantive page content to reason over rather than just
metadata.

Two backends are supported:

- **Brave Search API** (primary): requires a `BRAVE_SEARCH_API_KEY`
  environment variable. Free tier gives 2,000 queries/month. Returns
  rich web results including descriptions. See
  `references/brave-api.md` for key documentation.
- **Generic HTTP backend** (fallback / BYO): configured via
  `config/defaults.yaml` with a `genericSearch.url` template and
  optional headers. Lets users plug in any search API that returns a
  JSON array of `{ title, url, description }` objects.

The skill falls back to the generic backend automatically if
`BRAVE_SEARCH_API_KEY` is absent and `genericSearch.url` is configured.
If neither is available it exits with a clear error rather than silently
returning empty results.

## Behavior Patterns

- Stage 1 — **Search**: sends the query to the configured backend and
  returns up to `--count` results (default 5, max 10). Normalises the
  response into a common `{ title, url, description }` shape regardless
  of backend.
- Stage 2 — **Fetch**: retrieves each result URL via HTTP GET with a
  configurable `User-Agent` and timeout. Skips URLs that return non-200
  status or time out, reporting them as `{ status: "fetch-failed" }`
  rather than crashing the pipeline.
- Stage 3 — **Summarise**: strips HTML tags and boilerplate (nav, footer,
  script/style elements) from each fetched page, splits the remaining
  text into sentences, and selects the top-K most query-relevant
  sentences using a simple TF-IDF-style overlap score (no external ML
  dependency). Reports up to `--sentences` key sentences per page
  (default 5).
- Outputs a ranked JSON array, ordered by Brave's ranking (or the
  backend's native order), with fetch-failed pages listed last.
- Optionally writes results to `--output` as a Markdown report with one
  section per result, suitable for piping into `documentation` or
  `design-md`.

## When to Use

- Grounding a `plan` or `design-md` with current real-world information
  before implementation begins.
- Researching a library, API, or pattern before choosing one.
- Feeding up-to-date context into any downstream skill that currently
  relies on the agent's training-data knowledge cutoff.
- Not suitable for: queries requiring authenticated web sessions, JS-
  rendered SPAs (the fetcher is a plain HTTP GET — it sees the initial
  HTML only), or real-time data like stock prices where a single-point-
  in-time fetch isn't meaningful.

## Example Invocations

```
/skill run web-search --query "Bun 1.2 release notes"
/skill run web-search --query "rate limiting algorithms comparison" --count 5 --sentences 6
/skill run web-search --query "OpenTelemetry Node.js setup" --output references/otel-research.md
/skill run web-search --query "HNSW index vs IVF vector search" --backend generic
```

## Expected Inputs

- `--query` (string, required): the search query.
- `--count` (number, optional, default 5, max 10): number of search
  results to fetch and summarise.
- `--sentences` (number, optional, default 5): key sentences to extract
  per page.
- `--output` (path, optional): write a Markdown report to this path
  in addition to JSON stdout.
- `--backend` (brave|generic, optional): override backend
  auto-detection.
- `--timeout-ms` (number, optional, default 8000): per-URL fetch
  timeout in milliseconds.

## Expected Outputs

JSON array on stdout:

```json
[
  {
    "rank": 1,
    "title": "Page title",
    "url": "https://...",
    "description": "Snippet from search API",
    "status": "ok",
    "keySentences": ["...", "..."],
    "relevanceScore": 0.74
  },
  {
    "rank": 2,
    "url": "https://...",
    "status": "fetch-failed",
    "reason": "HTTP 403"
  }
]
```

When `--output` is given, a Markdown file is also written with one
`## Result N` section per successful fetch.

## Side Effects and Warnings

- Makes real outbound HTTP requests — requires network access and
  consumes Brave API quota (2,000 free queries/month on the free tier).
- `BRAVE_SEARCH_API_KEY` must be set in the environment or in a `.env`
  file at the project root; the skill never hardcodes or logs the key.
- Fetched page content is processed entirely in memory and never written
  to disk unless `--output` is given for the summarised Markdown report —
  raw HTML is never persisted.
- The summariser is keyword-overlap based, not semantic — it will miss
  relevant sentences that don't share vocabulary with the query, and
  may surface irrelevant sentences that share surface-level terms. For
  deep research, read the linked pages directly rather than relying
  solely on the extracted sentences.
- Respects a configurable `User-Agent` (default `harness-web-search/1.0`)
  and timeout; does not bypass robots.txt programmatically (a plain GET
  honours whatever the server returns, but makes no attempt to parse or
  enforce robots.txt rules). Use responsibly.
