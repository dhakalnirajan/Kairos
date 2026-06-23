#!/usr/bin/env bun
/**
 * git-workflow/scripts/run.ts
 *
 * Drafts conventional commit messages from staged diffs, validates branch
 * naming, and builds PR descriptions from commit history. Read-only
 * against git state — never commits, pushes, or branches.
 */

import { parseArgs } from "util";
import { spawnSync } from "child_process";

interface GitArgs {
  commitMessage: boolean;
  checkBranch: boolean;
  prDescription: boolean;
  base: string;
}

function parseCliArgs(): GitArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "commit-message": { type: "boolean", default: false },
      "check-branch": { type: "boolean", default: false },
      "pr-description": { type: "boolean", default: false },
      base: { type: "string", default: "main" },
    },
  });

  const flags = [values["commit-message"], values["check-branch"], values["pr-description"]].filter(Boolean);
  if (flags.length !== 1) {
    console.error("Error: exactly one of --commit-message, --check-branch, --pr-description is required");
    process.exit(1);
  }

  return {
    commitMessage: values["commit-message"] as boolean,
    checkBranch: values["check-branch"] as boolean,
    prDescription: values["pr-description"] as boolean,
    base: (values.base as string) ?? "main",
  };
}

function git(args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf-8" });
  return result.stdout ?? "";
}

function classifyChange(diffNameStatus: string): { type: string; scope: string | null } {
  const lines = diffNameStatus.trim().split("\n").filter(Boolean);
  let type = "chore";
  let scope: string | null = null;

  const files = lines.map((l) => l.split("\t").pop() ?? "");
  if (files.some((f) => /\.(test|spec)\.(ts|js|tsx|jsx)$|test_.*\.py$/.test(f))) {
    type = "test";
  } else if (files.some((f) => /\.md$|^docs\//.test(f))) {
    type = "docs";
  } else if (lines.some((l) => l.startsWith("A\t"))) {
    type = "feat";
  } else if (files.some((f) => /fix|bug/i.test(f))) {
    type = "fix";
  } else if (lines.every((l) => l.startsWith("M\t"))) {
    type = "refactor";
  }

  if (files.length > 0) {
    const dirs = files.map((f) => f.split("/")[0]).filter((d) => d && !d.includes("."));
    const uniqueDirs = [...new Set(dirs)];
    if (uniqueDirs.length === 1) scope = uniqueDirs[0];
  }

  return { type, scope };
}

function commitMessage() {
  const staged = git(["diff", "--staged", "--name-status"]);
  if (!staged.trim()) {
    console.error(JSON.stringify({ error: "no-staged-changes", message: "git diff --staged is empty. Stage changes before requesting a commit message." }, null, 2));
    process.exit(1);
  }

  const { type, scope } = classifyChange(staged);
  const files = staged.trim().split("\n").map((l) => l.split("\t").pop()).filter(Boolean);
  const summary = files.length === 1
    ? `update ${files[0]}`
    : `update ${files.length} files in ${scope ?? "multiple areas"}`;

  const prefix = scope ? `${type}(${scope})` : type;
  const message = `${prefix}: ${summary}`;
  const suggestedCommand = `git commit -m ${JSON.stringify(message)}`;

  console.log(JSON.stringify({ type, scope, message, suggestedCommand }, null, 2));
}

function checkBranch() {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  const pattern = "^(feat|fix|chore|docs)\\/[a-z0-9-]+$";
  const valid = new RegExp(pattern).test(branch);
  console.log(JSON.stringify({ branch, valid, pattern }, null, 2));
  process.exit(valid ? 0 : 1);
}

function prDescription(base: string) {
  const log = git(["log", `${base}..HEAD`, "--oneline"]);
  const lines = log.trim().split("\n").filter(Boolean);

  if (lines.length === 0) {
    console.log(JSON.stringify({ base, commitCount: 0, description: `No commits found between ${base} and HEAD.` }, null, 2));
    return;
  }

  const groups: Record<string, string[]> = {};
  for (const line of lines) {
    const msg = line.replace(/^[a-f0-9]+\s+/, "");
    const m = msg.match(/^(\w+)(\([\w-]+\))?:\s*(.+)/);
    const type = m ? m[1] : "other";
    if (!groups[type]) groups[type] = [];
    groups[type].push(msg);
  }

  const sections = Object.entries(groups)
    .map(([type, msgs]) => `### ${type}\n${msgs.map((m) => `- ${m}`).join("\n")}`)
    .join("\n\n");

  const description = `## Summary\n${lines.length} commit(s) since \`${base}\`.\n\n## Changes\n\n${sections}\n`;
  console.log(JSON.stringify({ base, commitCount: lines.length, description }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.commitMessage) commitMessage();
  else if (args.checkBranch) checkBranch();
  else if (args.prDescription) prDescription(args.base);
}

main();
