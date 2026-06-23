#!/usr/bin/env bun
/**
 * deployment/scripts/run.ts
 *
 * Validates static deployment preconditions: env var documentation
 * coverage, build script presence, basic Dockerfile sanity. Never
 * executes a build or deploy.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join } from "path";

interface DeployArgs {
  scope: string;
  skipDocker: boolean;
}

function parseCliArgs(): DeployArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scope: { type: "string" },
      "skip-docker": { type: "boolean", default: false },
    },
  });
  if (!values.scope) {
    console.error("Error: --scope is required");
    process.exit(1);
  }
  return { scope: values.scope as string, skipDocker: values["skip-docker"] as boolean };
}

function collectSourceFiles(scope: string): string[] {
  const acc: string[] = [];
  const walk = (dir: string) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if ([".git", "node_modules", "dist", "build"].includes(entry)) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

const ENV_REF_RE = /(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)/g;

function findReferencedEnvVars(scope: string): Set<string> {
  const files = collectSourceFiles(scope);
  const vars = new Set<string>();
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    ENV_REF_RE.lastIndex = 0;
    while ((m = ENV_REF_RE.exec(source))) vars.add(m[1]);
  }
  return vars;
}

function findDocumentedEnvVars(scope: string): Set<string> {
  const examplePath = join(scope, ".env.example");
  if (!existsSync(examplePath)) return new Set();
  const content = readFileSync(examplePath, "utf-8");
  const vars = new Set<string>();
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (m) vars.add(m[1]);
  }
  return vars;
}

function checkBuildScript(scope: string): boolean {
  const pkgPath = join(scope, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return !!(pkg.scripts && pkg.scripts.build);
  } catch {
    return false;
  }
}

function checkDockerfile(scope: string): { present: boolean; issues: string[] } | null {
  const dockerfilePath = join(scope, "Dockerfile");
  if (!existsSync(dockerfilePath)) return null;

  const content = readFileSync(dockerfilePath, "utf-8");
  const issues: string[] = [];

  if (/FROM\s+[^\s]+:latest\b/.test(content) || /FROM\s+[^\s:]+\s*$/m.test(content)) {
    issues.push("Base image uses 'latest' tag (or no tag) instead of a pinned version — builds are not reproducible.");
  }
  if (!/^USER\s+\S+/m.test(content)) {
    issues.push("No USER directive found — container likely runs as root by default.");
  }
  if (!existsSync(join(scope, ".dockerignore"))) {
    issues.push("No .dockerignore file found alongside Dockerfile — build context may include unnecessary or sensitive files.");
  }

  return { present: true, issues };
}

function main() {
  const args = parseCliArgs();

  const referenced = [...findReferencedEnvVars(args.scope)].sort();
  const documented = findDocumentedEnvVars(args.scope);
  const undocumented = referenced.filter((v) => !documented.has(v));

  const buildScript = checkBuildScript(args.scope);
  const docker = args.skipDocker ? null : checkDockerfile(args.scope);

  const checklist = [
    "Run the build locally and confirm it succeeds (this skill does not execute builds).",
    "Run smoke tests against a staging environment before production deploy.",
    "Confirm a rollback plan exists and has been tested.",
    "Confirm secrets are provisioned in the target environment (this skill only checks .env.example documentation, not actual secret values).",
  ];

  const report = {
    envVars: { referenced, undocumented },
    buildScript,
    docker,
    checklist,
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
