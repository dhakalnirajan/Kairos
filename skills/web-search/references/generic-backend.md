# Generic Backend Configuration and Summariser Internals

## Adding a Custom Search Backend

Any HTTP JSON API that returns a list of results can be used as the
generic backend. Set `genericSearch` in `config/defaults.yaml`:

```yaml
genericSearch:
  url: "https://api.example.com/search?q={query}&n={count}"
  resultsPath: data.results       # dot-path into response JSON
  titleField: title
  urlField: link
  descriptionField: snippet
  headers:
    X-Api-Key: "your-key-here"
```

The `url` template supports two tokens:
- `{query}` → URL-encoded search query string
- `{count}` → the `--count` argument value

`resultsPath` is a dot-separated path into the response JSON. For a flat
array response (`[{title, url, ...}]`), leave it empty or omit it. For a
nested response like `{ "data": { "results": [...] } }`, use
`data.results`.

## Summariser Internals

### Stage 1: HTML stripping

The fetched HTML passes through a sequence of regex replacements:
1. Remove `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`,
   `<noscript>` blocks and their content entirely.
2. Remove all remaining HTML tags (but keep text content).
3. Decode common HTML entities (`&amp;`, `&lt;`, etc.).
4. Collapse whitespace.

This is fast and dependency-free but imperfect — CSS-in-JS, shadow DOM,
heavily JavaScript-rendered pages, and unusual tag nesting can leave
noise in the extracted text.

### Stage 2: Sentence splitting

Splits on punctuation (`.`, `!`, `?`) followed by whitespace and an
uppercase letter. Filters sentences shorter than 30 characters (too
short to be meaningful) or longer than 600 characters (likely parsing
artefacts like concatenated elements). This is a heuristic and will
break on some abbreviations, decimal numbers, and code snippets embedded
in text.

### Stage 3: Relevance scoring (TF-IDF-style overlap)

For each sentence, the fraction of unique query tokens (after stop-word
removal) that also appear in the sentence is computed as the relevance
score. Sentences are ranked by this score descending; the top
`--sentences` are returned.

**This is keyword overlap, not semantic similarity.** It works well when
pages use the same vocabulary as the query, which is common for technical
searches. It under-performs when:
- The answer uses synonyms or paraphrases the query vocabulary avoids.
- The query is conceptual ("what causes X") and the page answers it
  with factual statements that don't repeat the query's exact words.
- Content is primarily in a different language.

For those cases, treat `keySentences` as a starting hint and read the
full page via the returned URL.

## Output Ordering

Results are returned in backend-native rank order (Brave's ranking or
the generic backend's list order), with `fetch-failed` entries sorted
to the end. The `rank` field always reflects the original search-result
position, not the final output position, so you can see where in the
original ranking a failed fetch was.
