#!/usr/bin/env bun
/**
 * security/scripts/run.ts
 *
 * Static scan for secret-shaped strings, SQL/command injection patterns,
 * and a small bundled list of known-vulnerable dependency versions.
 * Read-only.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface SecArgs {
  scan: string;
  depsOnly: boolean;
  codeOnly: boolean;
}

interface Finding {
  file: string;
  line: number | null;
  severity: "critical" | "high" | "medium";
  category: "secret" | "sql-injection" | "command-injection" | "vulnerable-dependency";
  message: string;
}

function parseCliArgs(): SecArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scan: { type: "string" },
      "deps-only": { type: "boolean", default: false },
      "code-only": { type: "boolean", default: false },
    },
  });
  if (!values.scan) {
    console.error("Error: --scan is required");
    process.exit(1);
  }
  return {
    scan: values.scan as string,
    depsOnly: values["deps-only"] as boolean,
    codeOnly: values["code-only"] as boolean,
  };
}

function collectFiles(scope: string): string[] {
  const st = statSync(scope);
  if (st.isFile()) return [scope];
  const acc: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if ([".git", "node_modules", "dist", "build"].includes(entry)) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

const SECRET_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /AKIA[0-9A-Z]{16}/, message: "String matches AWS access key ID format." },
  { re: /(?:api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/i, message: "String matches generic API key/secret assignment format." },
  { re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, message: "Private key PEM block found in source." },
];

const SQL_CONCAT_RE = /\bquery\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/;
const SQL_PARAMETERIZED_RE = /\bquery\s*\([^,]+,\s*\[/;

const CMD_INTERP_RE = /\b(exec|execSync|spawn)\s*\(\s*`[^`]*\$\{/;

function scanSecretsAndInjection(file: string): Finding[] {
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const lines = source.split("\n");
  const findings: Finding[] = [];

  lines.forEach((line, i) => {
    for (const { re, message } of SECRET_PATTERNS) {
      if (re.test(line)) {
        findings.push({ file, line: i + 1, severity: "critical", category: "secret", message });
      }
    }
    if (SQL_CONCAT_RE.test(line) && !SQL_PARAMETERIZED_RE.test(line)) {
      findings.push({
        file,
        line: i + 1,
        severity: "high",
        category: "sql-injection",
        message: "Query built via string concatenation/interpolation rather than parameterized arguments.",
      });
    }
    if (CMD_INTERP_RE.test(line)) {
      findings.push({
        file,
        line: i + 1,
        severity: "high",
        category: "command-injection",
        message: "Shell command built via template-literal interpolation rather than an argument array.",
      });
    }
  });
  return findings;
}

interface VulnEntry {
  package: string;
  vulnerableBelow: string;
  severity: "critical" | "high" | "medium";
  note: string;
}

function loadKnownVulnerable(): VulnEntry[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const refPath = join(here, "..", "references", "known-vulnerable.json");
  if (!existsSync(refPath)) return [];
  try {
    return JSON.parse(readFileSync(refPath, "utf-8"));
  } catch {
    return [];
  }
}

function versionLess(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

function checkDependencies(scope: string): Finding[] {
  const findings: Finding[] = [];
  const pkgPath = join(scope, "package.json");
  if (!existsSync(pkgPath)) return findings;

  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch {
    return findings;
  }
  const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
  const known = loadKnownVulnerable();

  for (const [name, range] of Object.entries(deps)) {
    const entry = known.find((k) => k.package === name);
    if (!entry) continue;
    const version = String(range).replace(/^[\^~>=<]+/, "");
    if (versionLess(version, entry.vulnerableBelow)) {
      findings.push({
        file: pkgPath,
        line: null,
        severity: entry.severity,
        category: "vulnerable-dependency",
        message: `${name}@${version} is below patched version ${entry.vulnerableBelow}. ${entry.note}`,
      });
    }
  }
  return findings;
}

function main() {
  const args = parseCliArgs();
  let findings: Finding[] = [];
  let scannedCount = 0;

  if (!args.depsOnly) {
    const files = collectFiles(args.scan);
    scannedCount = files.length;
    for (const f of files) findings = findings.concat(scanSecretsAndInjection(f));
  }
  if (!args.codeOnly) {
    findings = findings.concat(checkDependencies(args.scan));
  }

  const severityOrder = { critical: 0, high: 1, medium: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log(JSON.stringify({ scanned: scannedCount, findings }, null, 2));
  process.exit(findings.some((f) => f.severity === "critical") ? 1 : 0);
}

main();
