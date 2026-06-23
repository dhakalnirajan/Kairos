import { Database, type SQLQueryBindings } from "bun:sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";

export interface ProjectIndexRow {
  id: number;
  path: string;
  summary: string;
  hash: string;
  dependencies: string;
  lastIndexed: string;
}

export interface TopicFactRow {
  id: number;
  topic: string;
  fact: string;
  embedding: Buffer | null;
  createdAt: string;
}

export interface ConversationHistoryRow {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  timestamp: string;
  tokenCount: number;
}

export interface WorkflowMemoryRow {
  id: number;
  type: string;
  key: string;
  value: string;
  confidence: number;
  updatedAt: string;
}

export interface SessionRow {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRow {
  id: number;
  timestamp: string;
  toolName: string;
  parameters: string;
  result: string;
  duration: number;
}

export interface CronJobRow {
  id: number;
  schedule: string;
  command: string;
  lastRun: string | null;
  nextRun: string | null;
  enabled: number;
}

export interface SearchResult {
  rowid: number;
  rank: number;
}

export class MemoryDatabase {
  private db: Database;

  constructor(dbPath: string = ":memory:") {
    if (dbPath !== ":memory:") {
      mkdirSync(dirname(dbPath), { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.createSchema();
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL DEFAULT '',
        hash TEXT NOT NULL DEFAULT '',
        dependencies TEXT NOT NULL DEFAULT '[]',
        lastIndexed TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS topic_facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        fact TEXT NOT NULL,
        embedding BLOB,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS conversation_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        tokenCount INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS workflow_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('preference', 'decision', 'pattern')),
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        toolName TEXT NOT NULL,
        parameters TEXT NOT NULL DEFAULT '{}',
        result TEXT NOT NULL DEFAULT '',
        duration REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cron_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule TEXT NOT NULL,
        command TEXT NOT NULL,
        lastRun TEXT,
        nextRun TEXT,
        enabled INTEGER NOT NULL DEFAULT 1
      );
    `);

    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS conversation_history_fts USING fts5(
        sessionId UNINDEXED,
        content,
        timestamp UNINDEXED,
        content=conversation_history,
        content_rowid=id
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS topic_facts_fts USING fts5(
        topic,
        fact,
        createdAt UNINDEXED,
        content=topic_facts,
        content_rowid=id
      );
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS conversation_history_ai AFTER INSERT ON conversation_history BEGIN
        INSERT INTO conversation_history_fts(rowid, sessionId, content, timestamp)
        VALUES (new.id, new.sessionId, new.content, new.timestamp);
      END;

      CREATE TRIGGER IF NOT EXISTS conversation_history_ad AFTER DELETE ON conversation_history BEGIN
        INSERT INTO conversation_history_fts(conversation_history_fts, rowid, sessionId, content, timestamp)
        VALUES ('delete', old.id, old.sessionId, old.content, old.timestamp);
      END;

      CREATE TRIGGER IF NOT EXISTS topic_facts_ai AFTER INSERT ON topic_facts BEGIN
        INSERT INTO topic_facts_fts(rowid, topic, fact, createdAt)
        VALUES (new.id, new.topic, new.fact, new.createdAt);
      END;

      CREATE TRIGGER IF NOT EXISTS topic_facts_ad AFTER DELETE ON topic_facts BEGIN
        INSERT INTO topic_facts_fts(topic_facts_fts, rowid, topic, fact, createdAt)
        VALUES ('delete', old.id, old.topic, old.fact, old.createdAt);
      END;
    `);
  }

  insertProjectIndex(data: Omit<ProjectIndexRow, "id">): ProjectIndexRow {
    const stmt = this.db.prepare(
      "INSERT INTO project_index (path, summary, hash, dependencies, lastIndexed) VALUES (?, ?, ?, ?, ?)",
    );
    const info = stmt.run(data.path, data.summary, data.hash, data.dependencies, data.lastIndexed);
    return { id: Number(info.lastInsertRowid), ...data };
  }

  getProjectIndex(path: string): ProjectIndexRow | null {
    const stmt = this.db.prepare("SELECT * FROM project_index WHERE path = ?");
    return stmt.get(path) as ProjectIndexRow | null;
  }

  getAllProjectIndex(): ProjectIndexRow[] {
    return this.db.prepare("SELECT * FROM project_index").all() as ProjectIndexRow[];
  }

  updateProjectIndex(path: string, data: Partial<Omit<ProjectIndexRow, "id" | "path">>): void {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];
    if (data.summary !== undefined) { fields.push("summary = ?"); values.push(data.summary); }
    if (data.hash !== undefined) { fields.push("hash = ?"); values.push(data.hash); }
    if (data.dependencies !== undefined) { fields.push("dependencies = ?"); values.push(data.dependencies); }
    if (data.lastIndexed !== undefined) { fields.push("lastIndexed = ?"); values.push(data.lastIndexed); }
    if (fields.length === 0) return;
    values.push(path);
    this.db.prepare(`UPDATE project_index SET ${fields.join(", ")} WHERE path = ?`).run(...values);
  }

  deleteProjectIndex(path: string): void {
    this.db.prepare("DELETE FROM project_index WHERE path = ?").run(path);
  }

  insertTopicFact(data: Omit<TopicFactRow, "id" | "createdAt">): TopicFactRow {
    const stmt = this.db.prepare(
      "INSERT INTO topic_facts (topic, fact, embedding) VALUES (?, ?, ?)",
    );
    const emb = data.embedding ? Buffer.from(data.embedding) : null;
    const info = stmt.run(data.topic, data.fact, emb);
    return {
      id: Number(info.lastInsertRowid),
      topic: data.topic,
      fact: data.fact,
      embedding: emb,
      createdAt: new Date().toISOString(),
    };
  }

  getTopicFact(id: number): TopicFactRow | null {
    const row = this.db.prepare("SELECT * FROM topic_facts WHERE id = ?").get(id) as
      | (Omit<TopicFactRow, "embedding"> & { embedding: Buffer | null })
      | undefined;
    if (!row) return null;
    return { ...row };
  }

  getTopicFactsByTopic(topic: string): TopicFactRow[] {
    const rows = this.db.prepare("SELECT * FROM topic_facts WHERE topic = ?").all(topic) as Array<
      Omit<TopicFactRow, "embedding"> & { embedding: Buffer | null }
    >;
    return rows;
  }

  updateTopicFact(id: number, data: Partial<Pick<TopicFactRow, "topic" | "fact" | "embedding">>): void {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];
    if (data.topic !== undefined) { fields.push("topic = ?"); values.push(data.topic); }
    if (data.fact !== undefined) { fields.push("fact = ?"); values.push(data.fact); }
    if (data.embedding !== undefined) {
      fields.push("embedding = ?");
      values.push(data.embedding ? Buffer.from(data.embedding) : null);
    }
    if (fields.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE topic_facts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteTopicFact(id: number): void {
    this.db.prepare("DELETE FROM topic_facts WHERE id = ?").run(id);
  }

  insertConversationMessage(data: Omit<ConversationHistoryRow, "id" | "timestamp">): ConversationHistoryRow {
    const stmt = this.db.prepare(
      "INSERT INTO conversation_history (sessionId, role, content, tokenCount) VALUES (?, ?, ?, ?)",
    );
    const info = stmt.run(data.sessionId, data.role, data.content, data.tokenCount);
    return {
      id: Number(info.lastInsertRowid),
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
      timestamp: new Date().toISOString(),
      tokenCount: data.tokenCount,
    };
  }

  getConversationHistory(sessionId: string, limit?: number): ConversationHistoryRow[] {
    if (limit) {
      return this.db
        .prepare("SELECT * FROM conversation_history WHERE sessionId = ? ORDER BY timestamp ASC LIMIT ?")
        .all(sessionId, limit) as ConversationHistoryRow[];
    }
    return this.db
      .prepare("SELECT * FROM conversation_history WHERE sessionId = ? ORDER BY timestamp ASC")
      .all(sessionId) as ConversationHistoryRow[];
  }

  deleteConversationHistory(sessionId: string): void {
    this.db.prepare("DELETE FROM conversation_history WHERE sessionId = ?").run(sessionId);
  }

  insertWorkflowMemory(data: Omit<WorkflowMemoryRow, "id" | "updatedAt">): WorkflowMemoryRow {
    const stmt = this.db.prepare(
      "INSERT INTO workflow_memory (type, key, value, confidence) VALUES (?, ?, ?, ?)",
    );
    const info = stmt.run(data.type, data.key, data.value, data.confidence);
    return {
      id: Number(info.lastInsertRowid),
      type: data.type,
      key: data.key,
      value: data.value,
      confidence: data.confidence,
      updatedAt: new Date().toISOString(),
    };
  }

  getWorkflowMemory(type: string, key: string): WorkflowMemoryRow | null {
    const stmt = this.db.prepare("SELECT * FROM workflow_memory WHERE type = ? AND key = ?");
    return stmt.get(type, key) as WorkflowMemoryRow | null;
  }

  getAllWorkflowMemory(type?: string): WorkflowMemoryRow[] {
    if (type) {
      return this.db.prepare("SELECT * FROM workflow_memory WHERE type = ?").all(type) as WorkflowMemoryRow[];
    }
    return this.db.prepare("SELECT * FROM workflow_memory").all() as WorkflowMemoryRow[];
  }

  updateWorkflowMemory(type: string, key: string, value: string, confidence?: number): void {
    if (confidence !== undefined) {
      this.db.prepare(
        "UPDATE workflow_memory SET value = ?, confidence = ?, updatedAt = datetime('now') WHERE type = ? AND key = ?",
      ).run(value, confidence, type, key);
    } else {
      this.db.prepare(
        "UPDATE workflow_memory SET value = ?, updatedAt = datetime('now') WHERE type = ? AND key = ?",
      ).run(value, type, key);
    }
  }

  deleteWorkflowMemory(type: string, key: string): void {
    this.db.prepare("DELETE FROM workflow_memory WHERE type = ? AND key = ?").run(type, key);
  }

  insertSession(data: SessionRow): void {
    this.db.prepare(
      "INSERT OR REPLACE INTO sessions (id, title, model, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
    ).run(data.id, data.title, data.model, data.createdAt, data.updatedAt);
  }

  getSession(id: string): SessionRow | null {
    return this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | null;
  }

  getAllSessions(): SessionRow[] {
    return this.db.prepare("SELECT * FROM sessions ORDER BY updatedAt DESC").all() as SessionRow[];
  }

  updateSession(id: string, data: Partial<Pick<SessionRow, "title" | "model">>): void {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];
    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.model !== undefined) { fields.push("model = ?"); values.push(data.model); }
    if (fields.length === 0) return;
    fields.push("updatedAt = datetime('now')");
    values.push(id);
    this.db.prepare(`UPDATE sessions SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  insertAuditLog(data: Omit<AuditLogRow, "id" | "timestamp">): AuditLogRow {
    const stmt = this.db.prepare(
      "INSERT INTO audit_log (toolName, parameters, result, duration) VALUES (?, ?, ?, ?)",
    );
    const info = stmt.run(data.toolName, data.parameters, data.result, data.duration);
    return {
      id: Number(info.lastInsertRowid),
      timestamp: new Date().toISOString(),
      toolName: data.toolName,
      parameters: data.parameters,
      result: data.result,
      duration: data.duration,
    };
  }

  getAuditLogs(limit?: number, toolName?: string): AuditLogRow[] {
    if (toolName) {
      if (limit) {
        return this.db
          .prepare("SELECT * FROM audit_log WHERE toolName = ? ORDER BY timestamp DESC LIMIT ?")
          .all(toolName, limit) as AuditLogRow[];
      }
      return this.db
        .prepare("SELECT * FROM audit_log WHERE toolName = ? ORDER BY timestamp DESC")
        .all(toolName) as AuditLogRow[];
    }
    if (limit) {
      return this.db
        .prepare("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?")
        .all(limit) as AuditLogRow[];
    }
    return this.db.prepare("SELECT * FROM audit_log ORDER BY timestamp DESC").all() as AuditLogRow[];
  }

  insertCronJob(data: Omit<CronJobRow, "id">): CronJobRow {
    const stmt = this.db.prepare(
      "INSERT INTO cron_jobs (schedule, command, lastRun, nextRun, enabled) VALUES (?, ?, ?, ?, ?)",
    );
    const info = stmt.run(data.schedule, data.command, data.lastRun, data.nextRun, data.enabled);
    return { id: Number(info.lastInsertRowid), ...data };
  }

  getCronJob(id: number): CronJobRow | null {
    return this.db.prepare("SELECT * FROM cron_jobs WHERE id = ?").get(id) as CronJobRow | null;
  }

  getAllCronJobs(): CronJobRow[] {
    return this.db.prepare("SELECT * FROM cron_jobs").all() as CronJobRow[];
  }

  updateCronJob(id: number, data: Partial<Omit<CronJobRow, "id">>): void {
    const fields: string[] = [];
    const values: SQLQueryBindings[] = [];
    if (data.schedule !== undefined) { fields.push("schedule = ?"); values.push(data.schedule); }
    if (data.command !== undefined) { fields.push("command = ?"); values.push(data.command); }
    if (data.lastRun !== undefined) { fields.push("lastRun = ?"); values.push(data.lastRun); }
    if (data.nextRun !== undefined) { fields.push("nextRun = ?"); values.push(data.nextRun); }
    if (data.enabled !== undefined) { fields.push("enabled = ?"); values.push(data.enabled); }
    if (fields.length === 0) return;
    values.push(id);
    this.db.prepare(`UPDATE cron_jobs SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  }

  deleteCronJob(id: number): void {
    this.db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(id);
  }

  search(query: string, limit: number = 10): SearchResult[] {
    const ftsQuery = query
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => `"${w}"`)
      .join(" OR ");

    if (!ftsQuery) return [];

    const convResults = this.db.prepare(`
      SELECT rowid, rank FROM conversation_history_fts
      WHERE conversation_history_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as SearchResult[];

    const topicResults = this.db.prepare(`
      SELECT rowid, rank FROM topic_facts_fts
      WHERE topic_facts_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(ftsQuery, limit) as SearchResult[];

    return [...convResults, ...topicResults]
      .sort((a, b) => a.rank - b.rank)
      .slice(0, limit);
  }

  close(): void {
    this.db.close();
  }
}
