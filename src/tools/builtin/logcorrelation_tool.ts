import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface LogEntry {
  timestamp: string;
  level: string;
  source: string;
  message: string;
  correlationId?: string;
  raw: string;
}

function parseLogLine(line: string): LogEntry | null {
  const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[.\d]*\s*(?:Z|[+-]\d{2}:?\d{2})?)/);
  const levelMatch = line.match(/\b(DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL|CRITICAL)\b/i);
  const corrMatch = line.match(/(?:correlation[_-]?id|request[_-]?id|trace[_-]?id|span[_-]?id)[=:\s]+(\S+)/i);

  if (!tsMatch) return null;

  return {
    timestamp: tsMatch[1]!,
    level: levelMatch?.[1]?.toUpperCase() ?? 'INFO',
    source: '',
    message: line,
    correlationId: corrMatch?.[1],
    raw: line,
  };
}

export const logCorrelationTool: ToolInstance = {
  name: 'log_correlation',
  description: 'Log stream correlation: parse logs, correlate by request/trace ID, group by time, filter by level, detect anomalies',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['parse', 'correlate', 'filter', 'timeline', 'anomalies', 'stats'], description: 'Correlation action' },
      path: { type: 'string', description: 'Log file path' },
      content: { type: 'string', description: 'Raw log content to parse' },
      level: { type: 'string', description: 'Filter by log level (DEBUG/INFO/WARN/ERROR)' },
      correlation_id: { type: 'string', description: 'Correlation ID to trace' },
      window: { type: 'number', description: 'Time window in seconds for grouping' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      let logContent = String(params['content'] ?? '');
      if (!logContent && params.path) {
        const logPath = String(params.path);
        const resolved = existsSync(logPath) ? logPath : join(ctx.workspaceRoot, logPath);
        if (existsSync(resolved)) logContent = readFileSync(resolved, 'utf-8');
      }
      if (!logContent) return { success: false, output: '', error: 'No log content provided' };

      const lines = logContent.split('\n').filter((l) => l.trim());
      const entries = lines.map((l) => parseLogLine(l)).filter((e): e is LogEntry => e !== null);

      switch (action) {
        case 'parse': {
          const output = entries.map((e) => `[${e.timestamp}] [${e.level}] ${e.message.slice(0, 120)}`).join('\n');
          return { success: true, output: output || 'No parseable log entries', metadata: { entries: entries.length } };
        }
        case 'correlate': {
          const corrId = String(params['correlation_id'] ?? '');
          if (!corrId) return { success: false, output: '', error: 'correlation_id required' };
          const correlated = entries.filter((e) => e.correlationId === corrId);
          const output = correlated.map((e) => `[${e.timestamp}] [${e.level}] ${e.raw.slice(0, 150)}`).join('\n');
          return { success: true, output: output || `No entries for correlation ID: ${corrId}`, metadata: { count: correlated.length } };
        }
        case 'filter': {
          const level = String(params['level'] ?? 'ERROR').toUpperCase();
          const filtered = entries.filter((e) => e.level === level || e.level.startsWith(level.slice(0, 3)));
          const output = filtered.map((e) => `[${e.timestamp}] ${e.raw.slice(0, 150)}`).join('\n');
          return { success: true, output: output || `No ${level} entries`, metadata: { count: filtered.length } };
        }
        case 'timeline': {
          const window = Number(params['window'] ?? 60);
          const buckets = new Map<string, LogEntry[]>();
          for (const entry of entries) {
            const ts = new Date(entry.timestamp).getTime();
            const bucket = `${Math.floor(ts / (window * 1000)) * window * 1000}`;
            const existing = buckets.get(bucket) ?? [];
            existing.push(entry);
            buckets.set(bucket, existing);
          }
          const output = Array.from(buckets.entries())
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([ts, bucket]) => {
              const time = new Date(Number(ts)).toISOString();
              const levels = new Map<string, number>();
              for (const e of bucket) levels.set(e.level, (levels.get(e.level) ?? 0) + 1);
              const summary = Array.from(levels.entries()).map(([l, c]) => `${l}:${c}`).join(' ');
              return `${time} (${bucket.length} entries: ${summary})`;
            })
            .join('\n');
          return { success: true, output, metadata: { buckets: buckets.size } };
        }
        case 'anomalies': {
          const errorRate = entries.filter((e) => e.level === 'ERROR' || e.level === 'FATAL').length / Math.max(entries.length, 1);
          const uniqueCorrIds = new Set(entries.filter((e) => e.correlationId).map((e) => e.correlationId));
          const anomalies: string[] = [];
          if (errorRate > 0.1) anomalies.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
          if (entries.length > 1000) anomalies.push(`Large log volume: ${entries.length} entries`);
          if (uniqueCorrIds.size > 50) anomalies.push(`Many unique request IDs: ${uniqueCorrIds.size}`);
          const output = anomalies.length > 0 ? `Anomalies detected:\n${anomalies.map((a) => `⚠ ${a}`).join('\n')}` : 'No anomalies detected';
          return { success: true, output, metadata: { anomalies: anomalies.length } };
        }
        case 'stats': {
          const levels = new Map<string, number>();
          for (const e of entries) levels.set(e.level, (levels.get(e.level) ?? 0) + 1);
          const output = Array.from(levels.entries()).map(([l, c]) => `${l}: ${c} (${((c / entries.length) * 100).toFixed(1)}%)`).join('\n');
          return { success: true, output, metadata: { total: entries.length, levels: Object.fromEntries(levels) } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Log correlation failed: ${e}` };
    }
  },
};
