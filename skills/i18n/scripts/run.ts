#!/usr/bin/env bun
/**
 * i18n/scripts/run.ts
 *
 * Two modes: --find-hardcoded scans for untranslated user-facing strings;
 * --check-keys compares translation key sets across locale files. Read-only.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

interface I18nArgs {
  findHardcoded: boolean;
  checkKeys: boolean;
  scope?: string;
  base?: string;
  target?: string[];
}

function parseCliArgs(): I18nArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "find-hardcoded": { type: "boolean", default: false },
      "check-keys": { type: "boolean", default: false },
      scope: { type: "string" },
      base: { type: "string" },
      target: { type: "string" },
    },
  });

  const flags = [values["find-hardcoded"], values["check-keys"]].filter(Boolean);
  if (flags.length !== 1) {
    console.error("Error: exactly one of --find-hardcoded or --check-keys is required");
    process.exit(1);
  }
  if (values["find-hardcoded"] && !values.scope) {
    console.error("Error: --scope is required with --find-hardcoded");
    process.exit(1);
  }
  if (values["check-keys"] && (!values.base || !values.target)) {
    console.error("Error: --base and --target are required with --check-keys");
    process.exit(1);
  }

  return {
    findHardcoded: values["find-hardcoded"] as boolean,
    checkKeys: values["check-keys"] as boolean,
    scope: values.scope as string | undefined,
    base: values.base as string | undefined,
    target: values.target ? (values.target as string).split(",").map((t) => t.trim()) : undefined,
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
      else if (/\.(vue|html|tsx|jsx)$/.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

const TRANSLATED_CALL_RE = /\$?t\(\s*['"`]/;
const QUOTED_STRING_RE = /(?:>|placeholder=|title=|aria-label=)\s*["']?([A-Z][a-zA-Z]*(?:\s+[a-zA-Z]+){1,})["']?(?=<|"|')/g;
const CSS_SHAPE_RE = /^[a-z0-9-]+$/;

function isLikelyProse(text: string): boolean {
  if (CSS_SHAPE_RE.test(text)) return false;
  if (!/\s/.test(text)) return false;
  if (!/^[A-Z]/.test(text)) return false;
  return true;
}

function findHardcodedStrings(scope: string) {
  const files = collectFiles(scope);
  const candidates: { file: string; line: number; text: string }[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = source.split("\n");
    lines.forEach((line, i) => {
      if (TRANSLATED_CALL_RE.test(line)) return; // already routed through i18n on this line
      let m: RegExpExecArray | null;
      QUOTED_STRING_RE.lastIndex = 0;
      while ((m = QUOTED_STRING_RE.exec(line))) {
        const text = m[1].trim();
        if (isLikelyProse(text)) {
          candidates.push({ file, line: i + 1, text });
        }
      }
    });
  }

  console.log(JSON.stringify({ scanned: files.length, candidates }, null, 2));
}

function flattenKeys(obj: any, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function checkKeys(basePath: string, targetPaths: string[]) {
  let baseKeys: Set<string>;
  try {
    baseKeys = new Set(flattenKeys(JSON.parse(readFileSync(basePath, "utf-8"))));
  } catch (e) {
    console.error(JSON.stringify({ error: "invalid-base-json", message: `Could not parse ${basePath}` }, null, 2));
    process.exit(1);
  }

  const results = targetPaths.map((target) => {
    try {
      const targetKeys = new Set(flattenKeys(JSON.parse(readFileSync(target, "utf-8"))));
      const missingKeys = [...baseKeys].filter((k) => !targetKeys.has(k));
      const orphanedKeys = [...targetKeys].filter((k) => !baseKeys.has(k));
      return { locale: target, missingKeys, orphanedKeys };
    } catch {
      return { locale: target, missingKeys: [], orphanedKeys: [], error: "could not parse file" };
    }
  });

  console.log(JSON.stringify({ base: basePath, results }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.findHardcoded) {
    findHardcodedStrings(args.scope!);
  } else if (args.checkKeys) {
    checkKeys(args.base!, args.target!);
  }
}

main();
