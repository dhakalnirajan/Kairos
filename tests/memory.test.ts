import { describe, test, expect } from 'bun:test';
import { MemoryDatabase } from '../src/memory/database.ts';

describe('MemoryDatabase', () => {
  test('creates in-memory database', () => {
    const db = new MemoryDatabase(':memory:');
    expect(db).toBeDefined();
    db.close();
  });

  test('insert and get project index', () => {
    const db = new MemoryDatabase(':memory:');
    const row = db.insertProjectIndex({
      path: 'src/main.ts',
      summary: 'Main entry point',
      hash: 'abc123',
      dependencies: '[]',
      lastIndexed: new Date().toISOString(),
    });
    expect(row.id).toBeGreaterThan(0);

    const fetched = db.getProjectIndex('src/main.ts');
    expect(fetched).not.toBeNull();
    expect(fetched?.summary).toBe('Main entry point');
    db.close();
  });

  test('insert and get topic facts', () => {
    const db = new MemoryDatabase(':memory:');
    const fact = db.insertTopicFact({ topic: 'config', fact: 'Uses Zod for validation', embedding: null });
    expect(fact.id).toBeGreaterThan(0);

    const fetched = db.getTopicFact(fact.id);
    expect(fetched?.topic).toBe('config');
    expect(fetched?.fact).toBe('Uses Zod for validation');
    db.close();
  });

  test('conversation history with FTS search', () => {
    const db = new MemoryDatabase(':memory:');
    db.insertConversationMessage({ sessionId: 's1', role: 'user', content: 'Hello world', tokenCount: 2 });
    db.insertConversationMessage({ sessionId: 's1', role: 'assistant', content: 'Hi there', tokenCount: 2 });
    db.insertConversationMessage({ sessionId: 's2', role: 'user', content: 'Goodbye world', tokenCount: 2 });

    const history = db.getConversationHistory('s1');
    expect(history.length).toBe(2);

    const results = db.search('hello');
    expect(results.length).toBeGreaterThan(0);
    db.close();
  });

  test('workflow memory CRUD', () => {
    const db = new MemoryDatabase(':memory:');
    const wm = db.insertWorkflowMemory({ type: 'preference', key: 'theme', value: 'dark', confidence: 0.9 });
    expect(wm.id).toBeGreaterThan(0);

    const fetched = db.getWorkflowMemory('preference', 'theme');
    expect(fetched?.value).toBe('dark');

    db.updateWorkflowMemory('preference', 'theme', 'light', 1.0);
    const updated = db.getWorkflowMemory('preference', 'theme');
    expect(updated?.value).toBe('light');

    db.deleteWorkflowMemory('preference', 'theme');
    expect(db.getWorkflowMemory('preference', 'theme')).toBeNull();
    db.close();
  });

  test('session CRUD', () => {
    const db = new MemoryDatabase(':memory:');
    const now = new Date().toISOString();
    db.insertSession({ id: 's1', title: 'Test Session', model: 'gpt-4', createdAt: now, updatedAt: now });

    const session = db.getSession('s1');
    expect(session?.title).toBe('Test Session');

    const all = db.getAllSessions();
    expect(all.length).toBe(1);

    db.deleteSession('s1');
    expect(db.getSession('s1')).toBeNull();
    db.close();
  });

  test('audit log', () => {
    const db = new MemoryDatabase(':memory:');
    db.insertAuditLog({ toolName: 'read_file', parameters: '{"path":"test"}', result: 'success', duration: 10 });

    const logs = db.getAuditLogs(10);
    expect(logs.length).toBe(1);
    expect(logs[0]?.toolName).toBe('read_file');
    db.close();
  });

  test('cron jobs', () => {
    const db = new MemoryDatabase(':memory:');
    const job = db.insertCronJob({ schedule: '0 * * * *', command: 'backup', lastRun: null, nextRun: null, enabled: 1 });
    expect(job.id).toBeGreaterThan(0);

    db.updateCronJob(job.id, { enabled: 0 });
    const updated = db.getCronJob(job.id);
    expect(updated?.enabled).toBe(0);

    db.deleteCronJob(job.id);
    expect(db.getCronJob(job.id)).toBeNull();
    db.close();
  });
});
