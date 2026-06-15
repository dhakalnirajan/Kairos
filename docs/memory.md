# Memory System

Kairos uses a persistent SQLite-backed memory system with FTS5 full-text search.

## Memory Tiers

| Tier | Description | Persistence |
|------|-------------|-------------|
| **Project** | Long-term project knowledge | Syncs with MEMORY.md |
| **Session** | Current session context | Auto-checkpointed |
| **Scratch** | Working notes | Syncs with notes.md |
| **Task** | Per-task progress | Tied to task tree |

## How It Works

1. **Auto-Checkpoint**: At 70% context window, memories are written to SQLite
2. **Context Reconstruction**: At 85%, context is rebuilt from checkpoint + recent messages
3. **Memory Search**: FTS5 MATCH queries with Porter stemming
4. **Dream Consolidation**: Extract key facts from session history

## Memory Commands

```bash
# Search memory
/recall authentication

# Store a fact
/remember The API uses bearer tokens

# View all memory
/memories

# Consolidate memory
/dream

# Compress old entries
/compress

# View memory stats
/memdump
```

## Memory Files

- `MEMORY.md` — Project-level memory (synced bidirectionally)
- `notes.md` — Scratch notes (synced with scratch tier)

## Memory Database

Located at:
- **Linux/macOS**: `~/.kairos/data/kairos.db`
- **Windows**: `AppData/Local/Kairos/data/kairos.db`

### Schema

```sql
-- Core memory storage
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  tier TEXT NOT NULL,        -- project/session/scratch/task
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5,
  pinned INTEGER DEFAULT 0,
  session_id TEXT,
  created_at TEXT,
  accessed_at TEXT,
  updated_at TEXT
);

-- Full-text search index
CREATE VIRTUAL TABLE memories_fts USING fts5(
  topic, content,
  content=memories,
  content_rowid=id
);
```

## Context Block Injection

The `buildContextBlock()` function creates a budgeted context block:

1. Walk project memory first (highest importance)
2. Add latest session checkpoint
3. Add up to 3 scratch notes
4. Stop when token budget is exceeded

## Dream Mode

`/dream` triggers memory consolidation:

1. Pull top-50 importance-ranked entries
2. LLM extracts durable facts as JSON
3. Facts merged into project memory via `mergeProjectFact()`
4. Old scratch entries compressed

## Memory Search

```typescript
// FTS5 search with ranking
memory.search("authentication", 10);
// Returns: [{ rowid, rank, ... }] sorted by FTS rank + importance
```

## Next Steps

- [Tools](tools.md) — Memory-related tools
- [Recipes](recipes.md) — Memory workflows
