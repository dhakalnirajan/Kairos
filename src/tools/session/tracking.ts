export interface TrackingEntry {
  id: string;
  timestamp: number;
  action: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export class TimeTracker {
  private entries: TrackingEntry[] = [];
  private activeTimers: Map<string, number> = new Map();

  startTimer(action: string): string {
    const id = `timer-${Date.now()}`;
    this.activeTimers.set(id, Date.now());
    return id;
  }

  stopTimer(id: string, action: string, metadata?: Record<string, unknown>): TrackingEntry | null {
    const start = this.activeTimers.get(id);
    if (!start) return null;

    const duration = Date.now() - start;
    this.activeTimers.delete(id);

    const entry: TrackingEntry = {
      id,
      timestamp: start,
      action,
      duration,
      metadata,
    };

    this.entries.push(entry);
    return entry;
  }

  getEntries(limit?: number): TrackingEntry[] {
    if (limit) {
      return this.entries.slice(-limit);
    }
    return [...this.entries];
  }

  getTotalTime(action?: string): number {
    if (action) {
      return this.entries
        .filter((e) => e.action === action)
        .reduce((sum, e) => sum + e.duration, 0);
    }
    return this.entries.reduce((sum, e) => sum + e.duration, 0);
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const entry of this.entries) {
      summary[entry.action] = (summary[entry.action] ?? 0) + entry.duration;
    }
    return summary;
  }

  exportCSV(): string {
    const lines = ['id,timestamp,action,duration,metadata'];
    for (const entry of this.entries) {
      lines.push(`${entry.id},${entry.timestamp},${entry.action},${entry.duration},${JSON.stringify(entry.metadata ?? {})}`);
    }
    return lines.join('\n');
  }

  clear(): void {
    this.entries = [];
    this.activeTimers.clear();
  }
}

export const timeTracker = new TimeTracker();
