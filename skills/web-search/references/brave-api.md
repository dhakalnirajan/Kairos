# Brave Search API Reference

## Getting a Key

1. Go to https://brave.com/search/api/
2. Sign up for the free tier (2,000 queries/month, no credit card required).
3. Create a subscription and copy your API key.
4. Set it in your environment:
   ```bash
   export BRAVE_SEARCH_API_KEY=BSAxxxxxxxxxxxxxxxxxx
   ```
   Or add it to a `.env` file at your project root:
   ```
   BRAVE_SEARCH_API_KEY=BSAxxxxxxxxxxxxxxxxxx
   ```

## Endpoint Used

```
GET https://api.search.brave.com/res/v1/web/search
```

**Required header:** `X-Subscription-Token: <your-key>`

**Key query parameters used by this skill:**

| Parameter | Value | Notes |
|---|---|---|
| `q` | URL-encoded query | The search query |
| `count` | 1–20 | Number of results; this skill caps at 10 |
| `safesearch` | `moderate` | Default; change in source if needed |

## Response Shape (simplified)

```json
{
  "web": {
    "results": [
      {
        "title": "Page title",
        "url": "https://...",
        "description": "Snippet text",
        "extra_snippets": ["..."]
      }
    ]
  }
}
```

## Rate Limits (free tier as of mid-2025)

- 2,000 queries/month
- 1 query/second burst limit

If you exceed the quota, the API returns HTTP 429. The skill will
surface this as a `search-failed` error with the HTTP status in the
message.

## Paid Tiers

Paid plans start at $3/month for 20,000 queries. See
https://brave.com/search/api/ for current pricing — it may have
changed since this document was written.
