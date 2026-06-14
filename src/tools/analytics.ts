export interface AnalyticsEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export class LocalAnalytics {
  private events: AnalyticsEvent[] = [];

  track(type: string, data: Record<string, unknown> = {}): void {
    this.events.push({
      type,
      timestamp: Date.now(),
      data,
    });
  }

  getEvents(type?: string, limit?: number): AnalyticsEvent[] {
    let events = this.events;
    if (type) {
      events = events.filter((e) => e.type === type);
    }
    if (limit) {
      events = events.slice(-limit);
    }
    return events;
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const event of this.events) {
      summary[event.type] = (summary[event.type] ?? 0) + 1;
    }
    return summary;
  }

  getTrend(type: string, hours: number = 24): number[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const events = this.events.filter(
      (e) => e.type === type && e.timestamp > cutoff
    );
    const buckets = new Array(24).fill(0);
    for (const event of events) {
      const hour = Math.floor((event.timestamp - cutoff) / (60 * 60 * 1000));
      if (hour >= 0 && hour < 24) {
        buckets[hour]++;
      }
    }
    return buckets;
  }

  clear(): void {
    this.events = [];
  }
}

export const localAnalytics = new LocalAnalytics();
