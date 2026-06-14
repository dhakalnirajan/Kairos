# Memory System

Kairos uses SQLite with FTS5 for persistent memory.

## Memory Layers

### Project Index
- File summaries and hashes
- Dependency tracking

### Topic/Fact Memory
- FTS5 full-text search
- BM25 ranking

### Conversation History
- Sliding window
- Automatic summarization

### Workflow Memory
- User preferences
- Bug-fix patterns

## Database Schema

```sql
CREATE TABLE project_index (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE,
  summary TEXT,
  hash TEXT,
  dependencies TEXT
);

CREATE TABLE topic_facts (
  id INTEGER PRIMARY KEY,
  topic TEXT,
  fact TEXT,
  embedding BLOB
);

CREATE TABLE conversation_history (
  id INTEGER PRIMARY KEY,
  sessionId TEXT,
  role TEXT,
  content TEXT,
  tokenCount INTEGER
);

CREATE TABLE workflow_memory (
  id INTEGER PRIMARY KEY,
  type TEXT,
  key TEXT,
  value TEXT,
  confidence REAL
);
```

## Memory Commands

```bash
/dream          # Consolidate memory
/compact        # Summarize context
/recall <query> # Search memory
/forget         # Clear memory
/rules          # Show learned rules
```

## Memory Operations

```json
{
  "name": "memory_ops",
  "parameters": {
    "action": "store",
    "key": "preference",
    "value": "Use TypeScript strict mode"
  }
}
```
