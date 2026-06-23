#!/usr/bin/env bun
/**
 * system-design/scripts/run.ts
 *
 * --diagram generates a Mermaid component or sequence diagram from
 * structured node/edge or actor/message input. --capacity generates a
 * back-of-envelope capacity estimation worksheet. Mutually exclusive.
 */

import { parseArgs } from "util";
import { writeFileSync } from "fs";

interface DesignArgs {
  diagram?: "component" | "sequence";
  nodes: string[];
  edges: string[];
  actors: string[];
  messages: string[];
  capacity: boolean;
  qps?: number;
  avgItemSizeKb?: number;
  growthRatePercent?: number;
  output?: string;
}

function parseCliArgs(): DesignArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      diagram: { type: "string" },
      node: { type: "string", multiple: true },
      edge: { type: "string", multiple: true },
      actor: { type: "string", multiple: true },
      message: { type: "string", multiple: true },
      capacity: { type: "boolean", default: false },
      qps: { type: "string" },
      "avg-item-size-kb": { type: "string" },
      "growth-rate-percent": { type: "string" },
      output: { type: "string" },
    },
  });

  if (!values.diagram && !values.capacity) {
    console.error("Error: one of --diagram or --capacity is required");
    process.exit(1);
  }
  if (values.diagram && values.capacity) {
    console.error("Error: --diagram and --capacity are mutually exclusive");
    process.exit(1);
  }
  if (values.diagram && !["component", "sequence"].includes(values.diagram as string)) {
    console.error("Error: --diagram must be component|sequence");
    process.exit(1);
  }

  return {
    diagram: values.diagram as "component" | "sequence" | undefined,
    nodes: (values.node as string[] | undefined) ?? [],
    edges: (values.edge as string[] | undefined) ?? [],
    actors: (values.actor as string[] | undefined) ?? [],
    messages: (values.message as string[] | undefined) ?? [],
    capacity: values.capacity as boolean,
    qps: values.qps ? parseFloat(values.qps as string) : undefined,
    avgItemSizeKb: values["avg-item-size-kb"] ? parseFloat(values["avg-item-size-kb"] as string) : undefined,
    growthRatePercent: values["growth-rate-percent"] ? parseFloat(values["growth-rate-percent"] as string) : undefined,
    output: values.output as string | undefined,
  };
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

function buildComponentDiagram(nodes: string[], edges: string[]): string {
  const nodeNames = new Map<string, string>(); // raw name -> id
  const lines: string[] = ["```mermaid", "graph TD"];

  for (const n of nodes) {
    const [name, type] = n.split(":");
    const id = sanitizeId(name);
    nodeNames.set(name.trim(), id);
    const label = type ? `${name}<br/><i>${type}</i>` : name;
    lines.push(`  ${id}["${label}"]`);
  }

  for (const e of edges) {
    const m = e.match(/^(.+?)->(.+?)(?::(.+))?$/);
    if (!m) {
      console.error(`Error: malformed --edge "${e}", expected "From->To" or "From->To:label"`);
      process.exit(1);
    }
    const [, fromRaw, toRaw, label] = m;
    const from = fromRaw.trim(), to = toRaw.trim();
    if (!nodeNames.has(from)) {
      console.error(`Error: edge references undeclared node "${from}". Declare it with --node first.`);
      process.exit(1);
    }
    if (!nodeNames.has(to)) {
      console.error(`Error: edge references undeclared node "${to}". Declare it with --node first.`);
      process.exit(1);
    }
    const arrow = label ? `-->|${label.trim()}|` : "-->";
    lines.push(`  ${nodeNames.get(from)} ${arrow} ${nodeNames.get(to)}`);
  }

  lines.push("```");
  return lines.join("\n");
}

function buildSequenceDiagram(actors: string[], messages: string[]): string {
  const actorSet = new Set(actors.map((a) => a.trim()));
  const lines: string[] = ["```mermaid", "sequenceDiagram"];

  for (const a of actors) lines.push(`  participant ${sanitizeId(a)} as ${a}`);

  for (const msg of messages) {
    const m = msg.match(/^(.+?)->(.+?):\s*(.+)$/);
    if (!m) {
      console.error(`Error: malformed --message "${msg}", expected "From->To: label"`);
      process.exit(1);
    }
    const [, fromRaw, toRaw, label] = m;
    const from = fromRaw.trim(), to = toRaw.trim();
    if (!actorSet.has(from)) {
      console.error(`Error: message references undeclared actor "${from}". Declare it with --actor first.`);
      process.exit(1);
    }
    if (!actorSet.has(to)) {
      console.error(`Error: message references undeclared actor "${to}". Declare it with --actor first.`);
      process.exit(1);
    }
    lines.push(`  ${sanitizeId(from)}->>${sanitizeId(to)}: ${label.trim()}`);
  }

  lines.push("```");
  return lines.join("\n");
}

function buildCapacityWorksheet(args: DesignArgs): string {
  const lines: string[] = [];
  lines.push("# Capacity Estimation Worksheet");
  lines.push("");

  lines.push("## Traffic");
  if (args.qps !== undefined) {
    const dailyRequests = args.qps * 86400;
    lines.push(`- QPS: ${args.qps}`);
    lines.push(`- Requests/day: ${dailyRequests.toLocaleString()}`);
  } else {
    lines.push("- QPS: _(estimate)_");
    lines.push("- Requests/day: _(estimate, QPS × 86,400)_");
  }
  lines.push("");

  lines.push("## Storage");
  if (args.qps !== undefined && args.avgItemSizeKb !== undefined) {
    const dailyMb = (args.qps * 86400 * args.avgItemSizeKb) / 1024;
    lines.push(`- Avg item size: ${args.avgItemSizeKb} KB`);
    lines.push(`- New data/day: ~${dailyMb.toFixed(1)} MB`);
    lines.push(`- New data/year: ~${((dailyMb * 365) / 1024).toFixed(1)} GB`);
  } else {
    lines.push("- Avg item size: _(estimate)_");
    lines.push("- New data/day: _(estimate, requests/day × avg item size)_");
    lines.push("- New data/year: _(estimate)_");
  }
  lines.push("");

  lines.push("## Growth");
  if (args.growthRatePercent !== undefined) {
    lines.push(`- Assumed annual growth rate: ${args.growthRatePercent}%`);
  } else {
    lines.push("- Assumed annual growth rate: _(estimate)_");
  }
  lines.push("");

  lines.push("## Bandwidth");
  if (args.qps !== undefined && args.avgItemSizeKb !== undefined) {
    const mbps = (args.qps * args.avgItemSizeKb * 8) / 1024;
    lines.push(`- Peak bandwidth (assuming peak ≈ avg QPS): ~${mbps.toFixed(2)} Mbps`);
  } else {
    lines.push("- Peak bandwidth: _(estimate, QPS × avg item size × 8 / 1024)_");
  }
  lines.push("");

  lines.push("## Caching");
  lines.push("- Hot data fraction: _(estimate, commonly 20% per 80/20 rule)_");
  lines.push("- Suggested cache size: _(estimate, hot fraction × total storage)_");
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = parseCliArgs();
  let output: string;

  if (args.diagram === "component") {
    output = buildComponentDiagram(args.nodes, args.edges);
  } else if (args.diagram === "sequence") {
    output = buildSequenceDiagram(args.actors, args.messages);
  } else {
    output = buildCapacityWorksheet(args);
  }

  if (args.output) {
    writeFileSync(args.output, output, "utf-8");
    console.log(`Output written to ${args.output}`);
  } else {
    console.log(output);
  }
}

main();
