#!/usr/bin/env bun
/**
 * api-design/scripts/run.ts
 *
 * --lint checks endpoint descriptors against REST naming/verb/status
 * conventions. --diff compares two OpenAPI-shaped JSON specs for breaking
 * changes. Read-only.
 */

import { parseArgs } from "util";
import { readFileSync } from "fs";

interface ApiDesignArgs {
  lint: boolean;
  endpoints: string[];
  diff: boolean;
  old?: string;
  newSpec?: string;
}

function parseCliArgs(): ApiDesignArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      lint: { type: "boolean", default: false },
      endpoint: { type: "string", multiple: true },
      diff: { type: "boolean", default: false },
      old: { type: "string" },
      new: { type: "string" },
    },
  });

  if (!values.lint && !values.diff) {
    console.error("Error: one of --lint or --diff is required");
    process.exit(1);
  }
  if (values.lint && (!values.endpoint || values.endpoint.length === 0)) {
    console.error("Error: at least one --endpoint is required with --lint");
    process.exit(1);
  }
  if (values.diff && (!values.old || !values.new)) {
    console.error("Error: --old and --new are required with --diff");
    process.exit(1);
  }

  return {
    lint: values.lint as boolean,
    endpoints: (values.endpoint as string[] | undefined) ?? [],
    diff: values.diff as boolean,
    old: values.old as string | undefined,
    newSpec: values.new as string | undefined,
  };
}

interface LintFinding {
  endpoint: string;
  severity: "error" | "warning";
  issue: string;
}

const EXPECTED_STATUS: Record<string, number> = { POST: 201, DELETE: 204 };

function lintEndpoint(descriptor: string): LintFinding[] {
  const m = descriptor.match(/^(\w+)\s+(\S+)\s*->\s*(\d+)$/);
  if (!m) {
    return [{ endpoint: descriptor, severity: "error", issue: `Malformed endpoint descriptor, expected "METHOD /path -> status".` }];
  }
  const [, method, path, statusStr] = m;
  const status = parseInt(statusStr, 10);
  const findings: LintFinding[] = [];

  // Plural-noun check: collection segments (not {placeholders}) should look plural.
  const segments = path.split("/").filter(Boolean);
  for (const seg of segments) {
    if (seg.startsWith("{")) continue;
    if (/^[a-zA-Z-]+$/.test(seg) && !seg.endsWith("s") && !["health", "metrics", "login", "logout", "search"].includes(seg)) {
      findings.push({ endpoint: descriptor, severity: "warning", issue: `Path segment "${seg}" looks singular; REST convention favors plural collection names (e.g. "users" not "user").` });
    }
  }

  // Verb-in-path check: a leading-segment verb (not after an {id}) suggests a non-RESTful action endpoint.
  const firstSegment = segments[0];
  if (firstSegment && /^(get|create|update|delete|fetch|activate|deactivate)[A-Z]/.test(firstSegment)) {
    findings.push({ endpoint: descriptor, severity: "warning", issue: `Path starts with a verb-like segment "${firstSegment}" — prefer a resource noun with the HTTP method conveying the action.` });
  }

  // Status code convention check.
  const expected = EXPECTED_STATUS[method.toUpperCase()];
  if (expected && status !== expected && status < 400) {
    findings.push({ endpoint: descriptor, severity: "warning", issue: `${method} typically returns ${expected}; got ${status}. Confirm this is intentional.` });
  }

  return findings;
}

function runLint(endpoints: string[]) {
  let findings: LintFinding[] = [];
  for (const e of endpoints) findings = findings.concat(lintEndpoint(e));
  console.log(JSON.stringify({ checked: endpoints.length, findings }, null, 2));
}

interface DiffChange {
  path: string;
  change: string;
}

function loadSpec(path: string): any {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function runDiff(oldPath: string, newPath: string) {
  const oldSpec = loadSpec(oldPath);
  const newSpec = loadSpec(newPath);

  const oldPaths = oldSpec.paths ?? {};
  const newPaths = newSpec.paths ?? {};

  const breakingChanges: DiffChange[] = [];
  const nonBreakingChanges: DiffChange[] = [];

  for (const path of Object.keys(oldPaths)) {
    if (!(path in newPaths)) {
      breakingChanges.push({ path, change: "Endpoint removed." });
      continue;
    }

    const oldMethods = oldPaths[path];
    const newMethods = newPaths[path];

    for (const method of Object.keys(oldMethods)) {
      if (!(method in newMethods)) {
        breakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: "Method removed for this path." });
        continue;
      }

      const oldOp = oldMethods[method];
      const newOp = newMethods[method];

      const oldRequired: string[] = oldOp.requestBody?.content?.["application/json"]?.schema?.required ?? [];
      const newRequired: string[] = newOp.requestBody?.content?.["application/json"]?.schema?.required ?? [];
      const newlyRequired = newRequired.filter((f) => !oldRequired.includes(f));
      for (const field of newlyRequired) {
        breakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: `Request field "${field}" is now required but was not before.` });
      }

      const oldRespSchema = oldOp.responses?.["200"]?.content?.["application/json"]?.schema?.properties ?? {};
      const newRespSchema = newOp.responses?.["200"]?.content?.["application/json"]?.schema?.properties ?? {};
      for (const [field, oldDef] of Object.entries<any>(oldRespSchema)) {
        if (field in newRespSchema) {
          const newDef = newRespSchema[field];
          if (oldDef.type && newDef.type && oldDef.type !== newDef.type) {
            breakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: `Response field "${field}" type changed from "${oldDef.type}" to "${newDef.type}".` });
          }
        } else {
          breakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: `Response field "${field}" removed.` });
        }
      }
      for (const field of Object.keys(newRespSchema)) {
        if (!(field in oldRespSchema)) {
          nonBreakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: `Response field "${field}" added.` });
        }
      }
    }

    for (const method of Object.keys(newMethods)) {
      if (!(method in oldMethods)) {
        nonBreakingChanges.push({ path: `${method.toUpperCase()} ${path}`, change: "New method added for this path." });
      }
    }
  }

  for (const path of Object.keys(newPaths)) {
    if (!(path in oldPaths)) {
      nonBreakingChanges.push({ path, change: "New endpoint added." });
    }
  }

  console.log(JSON.stringify({ breakingChanges, nonBreakingChanges }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.lint) runLint(args.endpoints);
  else if (args.diff) runDiff(args.old!, args.newSpec!);
}

main();
