#!/usr/bin/env bun
/**
 * accessibility/scripts/run.ts
 *
 * Pattern-based scan of Vue/HTML templates for common WCAG-relevant
 * issues: missing alt text, unlabeled inputs, non-semantic clickable
 * elements. Read-only.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

interface A11yArgs {
  scope: string;
}

interface Finding {
  file: string;
  line: number;
  issue: string;
  wcagCriterion: string;
  severity: "high" | "medium";
}

function parseCliArgs(): A11yArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { scope: { type: "string" } },
  });
  if (!values.scope) {
    console.error("Error: --scope is required");
    process.exit(1);
  }
  return { scope: values.scope as string };
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
      else if (/\.(vue|html)$/.test(entry)) acc.push(full);
    }
  };
  walk(scope);
  return acc;
}

function extractTemplateBlock(source: string, isVue: boolean): { content: string; offset: number } {
  if (!isVue) return { content: source, offset: 0 };
  const m = source.match(/<template[^>]*>/);
  if (!m || m.index === undefined) return { content: "", offset: 0 };
  const start = m.index + m[0].length;
  const endIdx = source.indexOf("</template>", start);
  const content = endIdx > -1 ? source.slice(start, endIdx) : source.slice(start);
  const offset = source.slice(0, start).split("\n").length - 1;
  return { content, offset };
}

const IMG_RE = /<img\b([^>]*)>/g;
const INPUT_LIKE_RE = /<(input|select|textarea)\b([^>]*)>/g;
const CLICKABLE_DIV_RE = /<(div|span)\b([^>]*\s(?:@click|onclick)=[^>]*)>/g;

function scanFile(file: string): Finding[] {
  let raw: string;
  try {
    raw = readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const isVue = file.endsWith(".vue");
  const { content, offset } = extractTemplateBlock(raw, isVue);
  if (!content) return [];

  const findings: Finding[] = [];
  const lines = content.split("\n");

  lines.forEach((line, i) => {
    const lineNo = offset + i + 1;

    let m: RegExpExecArray | null;
    IMG_RE.lastIndex = 0;
    while ((m = IMG_RE.exec(line))) {
      const attrs = m[1];
      if (!/\balt\s*=/.test(attrs)) {
        findings.push({ file, line: lineNo, issue: "<img> missing alt attribute.", wcagCriterion: "1.1.1 Non-text Content", severity: "high" });
      }
    }

    INPUT_LIKE_RE.lastIndex = 0;
    while ((m = INPUT_LIKE_RE.exec(line))) {
      const attrs = m[2];
      const hasLabelAssoc = /\baria-label\s*=|\baria-labelledby\s*=/.test(attrs);
      const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/);
      const hasMatchingLabel = idMatch ? new RegExp(`<label[^>]*for=["']${idMatch[1]}["']`).test(content) : false;
      if (!hasLabelAssoc && !hasMatchingLabel) {
        findings.push({ file, line: lineNo, issue: `<${m[1]}> has no associated label, aria-label, or aria-labelledby.`, wcagCriterion: "4.1.2 Name, Role, Value", severity: "high" });
      }
    }

    CLICKABLE_DIV_RE.lastIndex = 0;
    while ((m = CLICKABLE_DIV_RE.exec(line))) {
      const attrs = m[2];
      const hasKeyHandler = /@keydown|@keyup|onkeydown|onkeyup/.test(attrs);
      const hasRole = /\brole\s*=/.test(attrs);
      if (!hasKeyHandler && !hasRole) {
        findings.push({ file, line: lineNo, issue: `<${m[1]}> has a click handler but no keyboard handler or role attribute.`, wcagCriterion: "2.1.1 Keyboard", severity: "medium" });
      }
    }
  });

  return findings;
}

function main() {
  const args = parseCliArgs();
  const files = collectFiles(args.scope);
  let findings: Finding[] = [];
  for (const f of files) findings = findings.concat(scanFile(f));

  const severityOrder = { high: 0, medium: 1 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  console.log(JSON.stringify({ scanned: files.length, findings }, null, 2));
}

main();
