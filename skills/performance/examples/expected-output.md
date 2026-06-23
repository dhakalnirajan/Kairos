{
  "scanned": 2,
  "findings": [
    {
      "file": "src/api/handlers/orders.ts",
      "line": 18,
      "pattern": "n-plus-one",
      "note": "Query/fetch-like call appears inside a loop body — likely N+1. Consider batching before the loop."
    },
    {
      "file": "src/api/handlers/reports.ts",
      "line": 6,
      "pattern": "sync-io-in-handler",
      "note": "Synchronous I/O call in a file that looks like a request handler — blocks the event loop under load."
    }
  ]
}
