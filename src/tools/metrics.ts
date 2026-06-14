export interface MetricDefinition {
  name: string;
  description: string;
  threshold?: { warning: number; critical: number };
}

export interface MetricValue {
  metric: string;
  value: number;
  timestamp: number;
  status: 'ok' | 'warning' | 'critical';
}

export class QualityMetrics {
  private definitions: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();

  defineMetric(def: MetricDefinition): void {
    this.definitions.set(def.name, def);
  }

  recordValue(metric: string, value: number): void {
    const def = this.definitions.get(metric);
    let status: MetricValue['status'] = 'ok';

    if (def?.threshold) {
      if (value >= def.threshold.critical) {
        status = 'critical';
      } else if (value >= def.threshold.warning) {
        status = 'warning';
      }
    }

    const values = this.values.get(metric) ?? [];
    values.push({ metric, value, timestamp: Date.now(), status });
    this.values.set(metric, values);
  }

  getLatest(metric: string): MetricValue | undefined {
    const values = this.values.get(metric);
    return values?.[values.length - 1];
  }

  getHistory(metric: string, limit?: number): MetricValue[] {
    const values = this.values.get(metric) ?? [];
    if (limit) {
      return values.slice(-limit);
    }
    return [...values];
  }

  getScorecard(): Record<string, { value: number; status: string }> {
    const scorecard: Record<string, { value: number; status: string }> = {};

    for (const [metric] of this.definitions) {
      const latest = this.getLatest(metric);
      if (latest) {
        scorecard[metric] = { value: latest.value, status: latest.status };
      }
    }

    return scorecard;
  }

  clear(): void {
    this.values.clear();
  }
}

export const qualityMetrics = new QualityMetrics();
