#!/usr/bin/env bun
/**
 * sdlc/scripts/run.ts
 *
 * Thin orchestrator over plan / testing / code-review / security skill
 * entrypoints. --plan-only runs the planning stage; --verify runs the
 * post-implementation stages and aggregates a consolidated readiness report.
 */

import { parseArgs } from "util";
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

interface SdlcArgs {
  planOnly: boolean;
  verify: boolean;
  task: string;
  base: string;
  skillsDir: string;
}

function parseCliArgs(): SdlcArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "plan-only": { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      task: { type: "string" },
      base: { type: "string", default: "main" },
      "skills-dir": { type: "string", default: ".." },
    },
  });

  if (!values.task) {
    console.error("Error: --task is required");
    process.exit(1);
  }

  const verify = values.verify as boolean;
  const planOnly = (values["plan-only"] as boolean) || !verify;

  return {
    planOnly,
    verify,
    task: values.task as string,
    base: (values.base as string) ?? "main",
    skillsDir: (values["skills-dir"] as string) ?? "..",
  };
}

function runSkill(skillsDir: string, skillName: string, args: string[]): { ok: boolean; output: any; raw: string } {
  const entrypoint = join(skillsDir, skillName, "scripts", "run.ts");
  if (!existsSync(entrypoint)) {
    return { ok: false, output: null, raw: `Entrypoint not found: ${entrypoint}` };
  }
  const runner = process.env.SDLC_RUNNER ?? "bun";
  const runnerArgs = runner === "bun" ? [entrypoint, ...args] : ["--experimental-strip-types", entrypoint, ...args];
  const result = spawnSync(runner, runnerArgs, { encoding: "utf-8" });
  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  let parsed: any = null;
  try {
    // Find the last JSON object in stdout in case of leading log lines.
    const match = result.stdout?.match(/\{[\s\S]*\}\s*$/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = null;
  }
  return { ok: result.error === undefined, output: parsed, raw };
}

function runPlanStage(args: SdlcArgs) {
  const { output, raw } = runSkill(args.skillsDir, "plan", ["--task", args.task]);
  console.log(JSON.stringify({ stage: "plan", output: output ?? raw }, null, 2));
}

function runVerifyStage(args: SdlcArgs) {
  const testing = runSkill(args.skillsDir, "testing", []);
  const codeReview = runSkill(args.skillsDir, "code-review", ["--base", args.base, "--task", args.task]);
  const security = runSkill(args.skillsDir, "security", ["--scan", "."]);

  const testingOk = testing.output ? (testing.output.failed ?? 1) === 0 : false;
  const codeReviewOk = codeReview.output
    ? !(codeReview.output.comments ?? []).some((c: any) => c.severity === "blocking")
    : false;
  const securityOk = security.output
    ? !(security.output.findings ?? []).some((f: any) => f.severity === "critical")
    : false;

  const ready = testingOk && codeReviewOk && securityOk;

  console.log(
    JSON.stringify(
      {
        ready,
        stages: {
          testing: testing.output ?? { error: testing.raw },
          codeReview: codeReview.output ?? { error: codeReview.raw },
          security: security.output ?? { error: security.raw },
        },
      },
      null,
      2
    )
  );
}

function main() {
  const args = parseCliArgs();
  if (args.verify) runVerifyStage(args);
  else runPlanStage(args);
}

main();
