import type { ToolContext, ToolInstance } from "../../types/tools.ts";

export interface MetricDefinition {
  name: string;
  description: string;
  threshold?: { warning: number; critical: number };
}

export interface MetricValue {
  metric: string;
  value: number;
  timestamp: number;
  status: "ok" | "warning" | "critical";
}

export class QualityMetrics {
  private definitions: Map<string, MetricDefinition> = new Map();
  private values: Map<string, MetricValue[]> = new Map();

  defineMetric(def: MetricDefinition): void {
    this.definitions.set(def.name, def);
  }

  recordValue(metric: string, value: number): void {
    const def = this.definitions.get(metric);
    let status: MetricValue["status"] = "ok";

    if (def?.threshold) {
      if (value >= def.threshold.critical) {
        status = "critical";
      } else if (value >= def.threshold.warning) {
        status = "warning";
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

export const metricsTool: ToolInstance = {
  name: "metrics",
  description:
    "Record and report on quality metrics and scorecards for the workspace",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["define", "record", "latest", "history", "scorecard", "clear"],
        description: "Metric action to perform",
      },
      metric: { type: "string", description: "Metric name" },
      value: { type: "number", description: "Numeric value to record" },
      warning: { type: "number", description: "Warning threshold" },
      critical: { type: "number", description: "Critical threshold" },
      limit: { type: "number", description: "History limit" },
    },
    required: ["action"],
  },
  riskLevel: "read",
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext) {
    const action = String(params["action"] ?? "");
    const metric = String(params["metric"] ?? "");

    switch (action) {
      case "define": {
        if (!metric) {
          return { success: false, output: "", error: "metric is required" };
        }
        const warning = Number(params["warning"] ?? 0);
        const critical = Number(params["critical"] ?? 0);
        qualityMetrics.defineMetric({
          name: metric,
          description: `Metric ${metric}`,
          threshold: { warning, critical },
        });
        return {
          success: true,
          output: `Metric defined: ${metric}`,
          metadata: { metric, warning, critical },
        };
      }
      case "record": {
        if (!metric) {
          return { success: false, output: "", error: "metric is required" };
        }
        const value = Number(params["value"] ?? NaN);
        if (Number.isNaN(value)) {
          return { success: false, output: "", error: "value is required" };
        }
        qualityMetrics.recordValue(metric, value);
        return {
          success: true,
          output: `Recorded ${metric}=${value}`,
          metadata: { metric, value },
        };
      }
      case "latest": {
        const latest = qualityMetrics.getLatest(metric);
        if (!latest) {
          return {
            success: true,
            output: `No data for ${metric}`,
            metadata: { metric },
          };
        }
        return {
          success: true,
          output: `Latest ${metric}: ${latest.value} (${latest.status})`,
          metadata: latest as unknown as Record<string, unknown>,
        };
      }
      case "history": {
        const limit = Number(params["limit"] ?? 0) || undefined;
        const history = qualityMetrics.getHistory(metric, limit);
        const output =
          history.length === 0
            ? `No history for ${metric}`
            : history
                .map(
                  (v) =>
                    `${new Date(v.timestamp).toISOString()}: ${v.value} (${v.status})`,
                )
                .join("\n");
        return {
          success: true,
          output,
          metadata: { metric, count: history.length },
        };
      }
      case "scorecard": {
        const scorecard = qualityMetrics.getScorecard();
        return {
          success: true,
          output: JSON.stringify(scorecard, null, 2),
          metadata: scorecard,
        };
      }
      case "clear": {
        qualityMetrics.clear();
        return { success: true, output: "Metrics cleared" };
      }
      default:
        return {
          success: false,
          output: "",
          error: `Unknown action: ${action}`,
        };
    }
  },
};
