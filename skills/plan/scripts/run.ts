#!/usr/bin/env bun
/**
 * plan/scripts/run.ts
 *
 * Reads a task description, inspects the repository for likely-affected
 * files, and emits a Markdown implementation plan. Read-only against
 * source files; only ever writes the plan document itself.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

interface PlanArgs {
  task: string;
  scope: string;
  output?: string;
  depth: "shallow" | "normal" | "deep";
}

function parseCliArgs(): PlanArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      task: { type: "string" },
      scope: { type: "string", default: "." },
      output: { type: "string" },
      depth: { type: "string", default: "normal" },
    },
  });

  if (!values.task) {
    console.error("Error: --task is required");
    process.exit(1);
  }

  const depth = (values.depth ?? "normal") as PlanArgs["depth"];
  if (!["shallow", "normal", "deep"].includes(depth)) {
    console.error(`Error: --depth must be shallow|normal|deep, got "${depth}"`);
    process.exit(1);
  }

  return {
    task: values.task as string,
    scope: (values.scope as string) ?? ".",
    output: values.output as string | undefined,
    depth,
  };
}

/** Extract candidate search keywords from a free-text task description. */
function extractKeywords(task: string): string[] {
  const stop = new Set([
    "the", "a", "an", "to", "for", "of", "and", "or", "in", "on", "with",
    "add", "fix", "update", "change", "make", "create",
  ]);
  return [...new Set(
    task
      .toLowerCase()
      .replace(/[^a-z0-9_\-\/. ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stop.has(w))
  )];
}

function walk(dir: string, depthLimit: number, acc: string[] = [], level = 0): string[] {
  if (level > depthLimit) return acc;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if ([".git", "node_modules", "dist", "build", ".next"].includes(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, depthLimit, acc, level + 1);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

function findCandidateFiles(scope: string, keywords: string[], depth: PlanArgs["depth"]): string[] {
  const depthLimit = depth === "shallow" ? 2 : depth === "deep" ? 8 : 4;
  const allFiles = walk(scope, depthLimit);
  const scored = allFiles
    .map((f) => {
      const lower = f.toLowerCase();
      const hits = keywords.filter((k) => lower.includes(k)).length;
      return { file: f, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 15)
    .map((x) => relative(scope, x.file));
  return scored;
}

function buildPlan(args: PlanArgs, candidates: string[]): string {
  const riskKeywords = ["auth", "payment", "migration", "schema", "delete", "billing"];
  const flaggedRisk = riskKeywords.some((k) => args.task.toLowerCase().includes(k));

  const steps = [
    "Identify the precise entry point (route handler, function, or component) the task refers to.",
    candidates.length
      ? `Review the ${candidates.length} candidate file(s) listed below for current behavior.`
      : "No strong file candidates found by keyword match — confirm scope manually before proceeding.",
    "Write or update tests that describe the desired behavior (see the `tdd` skill).",
    "Implement the change in the smallest viable diff.",
    "Run the existing test suite plus any new tests (see the `testing` skill).",
    "Self-review the diff for scope creep (see the `code-review` skill).",
  ];

  const lines: string[] = [];
  lines.push(`# Implementation Plan`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(args.task);
  lines.push("");
  lines.push(`## Affected Files (candidates)`);
  if (candidates.length === 0) {
    lines.push("_No files matched by keyword search. Narrow `--scope` or describe the task more specifically._");
  } else {
    for (const c of candidates) lines.push(`- \`${c}\``);
  }
  lines.push("");
  lines.push(`## Steps`);
  steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push("");
  lines.push(`## Risks`);
  lines.push(
    flaggedRisk
      ? "- Task description mentions a sensitive area (auth/payments/schema/migration/billing). Recommend a second reviewer before merge."
      : "- No high-risk keywords detected. Standard review process applies."
  );
  lines.push("");
  lines.push(`## Open Questions`);
  lines.push("- _(fill in manually — this tool does not infer intent beyond keyword matching)_");
  lines.push("");
  lines.push(`## Suggested Follow-up Skills`);
  lines.push("- `tdd` — write failing tests for the new behavior first");
  lines.push("- `code-generation` — implement once the plan is approved");
  lines.push("- `code-review` — review the resulting diff");
  lines.push("");

  return lines.join("\n");
}

function main() {
  const args = parseCliArgs();
  const keywords = extractKeywords(args.task);
  const candidates = findCandidateFiles(args.scope, keywords, args.depth);
  const plan = buildPlan(args, candidates);

  if (args.output) {
    writeFileSync(args.output, plan, "utf-8");
    console.log(`Plan written to ${args.output}`);
  } else {
    console.log(plan);
  }
}

main();
