---
title: Research
sidebar_position: 2
description: Research engine for web searches and information retrieval.
---

# Research Engine

Kairos includes a research engine for web searches and information retrieval.

## Research Strategies

| Strategy | Engines | Use Case |
|----------|---------|----------|
| `quick` | DuckDuckGo | Fast, general queries |
| `deep` | DDG + Bing + Brave | Thorough research |
| `code` | GitHub + StackOverflow + npm | Code-related queries |
| `academic` | arXiv + Wikipedia | Academic papers |
| `comparative` | 5 engines | Comparison queries |

## Usage

```bash
# Quick research
/research quick "React useEffect cleanup"

# Deep research
/research deep "distributed consensus algorithms"

# Code research
/research code "bun sqlite best practices"

# Academic research
/research academic "attention mechanism transformer"

# Comparative research
/research comparative "bun vs deno performance"
```

## Tool Usage

```typescript
// Via agent tool
web_search({ query: "React hooks best practices", limit: 5 })

// Via HTTP fetch
http_fetch({ url: "https://example.com", format: "text" })
```

## Search Engines

### DuckDuckGo (Default)
- HTML scraping with fallback patterns
- No API key required
- Rate-limited

### Brave Search
- Requires API key
- Better results for technical queries

### GitHub Code Search
- Searches public repositories
- Finds code examples and implementations

### StackOverflow
- Q&A format results
- Excellent for debugging questions

### npm / PyPI
- Package information
- Version history

## Next Steps

- [Tools](../user-guide/tools.md) — Web-related tools
- [Providers](../user-guide/providers.md) — Search configuration