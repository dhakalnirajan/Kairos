#!/usr/bin/env bun
/**
 * obsidian-vault-architect/scripts/run.ts
 *
 * --audit checks an Obsidian vault for broken wikilinks, orphaned notes,
 * and tag casing inconsistencies. --new-note scaffolds a note matching
 * the vault's existing frontmatter convention. Read-only except for
 * --new-note's single file write.
 */

import { parseArgs } from "util";
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, basename } from "path";

interface VaultArgs {
  audit: boolean;
  newNote: boolean;
  vault: string;
  title?: string;
}

function parseCliArgs(): VaultArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      audit: { type: "boolean", default: false },
      "new-note": { type: "boolean", default: false },
      vault: { type: "string" },
      title: { type: "string" },
    },
  });

  if (!values.audit && !values["new-note"]) {
    console.error("Error: one of --audit or --new-note is required");
    process.exit(1);
  }
  if (!values.vault) {
    console.error("Error: --vault is required");
    process.exit(1);
  }
  if (values["new-note"] && !values.title) {
    console.error("Error: --title is required with --new-note");
    process.exit(1);
  }

  return {
    audit: values.audit as boolean,
    newNote: values["new-note"] as boolean,
    vault: values.vault as string,
    title: values.title as string | undefined,
  };
}

function collectNotes(vault: string): string[] {
  const acc: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      const s = statSync(full);
      if (s.isDirectory()) walk(full);
      else if (entry.endsWith(".md")) acc.push(full);
    }
  };
  walk(vault);
  return acc;
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]+)?(?:#[^\]]+)?\]\]/g;
const TAG_RE = /(?:^|\s)#([a-zA-Z0-9_-]+)/g;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

function noteNameOf(file: string): string {
  return basename(file, ".md");
}

function runAudit(vault: string) {
  const files = collectNotes(vault);
  const noteNames = new Set(files.map((f) => noteNameOf(f).toLowerCase()));
  const noteByLowerName = new Map(files.map((f) => [noteNameOf(f).toLowerCase(), f]));

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, Set<string>>();
  const brokenLinks: { file: string; target: string }[] = [];
  const allTags = new Set<string>();

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const links: string[] = [];
    let m: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;
    while ((m = WIKILINK_RE.exec(source))) {
      const target = m[1].trim();
      links.push(target);
      if (!noteNames.has(target.toLowerCase())) {
        brokenLinks.push({ file, target });
      } else {
        const targetFile = noteByLowerName.get(target.toLowerCase())!;
        const set = incoming.get(targetFile) ?? new Set();
        set.add(file);
        incoming.set(targetFile, set);
      }
    }
    outgoing.set(file, links);

    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(source))) allTags.add(m[1]);
  }

  const orphanedNotes = files.filter((f) => (outgoing.get(f)?.length ?? 0) === 0 && (incoming.get(f)?.size ?? 0) === 0);

  // Group tags by normalized form to find casing/separator inconsistencies.
  const groups = new Map<string, Set<string>>();
  for (const tag of allTags) {
    const normalized = tag.toLowerCase().replace(/[-_]/g, "");
    const set = groups.get(normalized) ?? new Set();
    set.add(tag);
    groups.set(normalized, set);
  }
  const tagInconsistencies = [...groups.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([normalized, variants]) => ({ normalized, variants: [...variants] }));

  console.log(
    JSON.stringify(
      {
        notesScanned: files.length,
        brokenLinks,
        orphanedNotes,
        tagInconsistencies,
      },
      null,
      2
    )
  );
}

function detectFrontmatterConvention(vault: string): string[] {
  const files = collectNotes(vault).slice(0, 20);
  const keyCounts = new Map<string, number>();
  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const m = source.match(FRONTMATTER_RE);
    if (!m) continue;
    for (const line of m[1].split("\n")) {
      const km = line.match(/^(\w+):/);
      if (km) keyCounts.set(km[1], (keyCounts.get(km[1]) ?? 0) + 1);
    }
  }
  const threshold = Math.max(1, Math.floor(files.length * 0.5));
  const common = [...keyCounts.entries()].filter(([, count]) => count >= threshold).map(([k]) => k);
  return common.length > 0 ? common : ["title", "created", "tags"];
}

function slugify(title: string): string {
  return title.replace(/[\\/:*?"<>|]/g, "").trim();
}

function createNewNote(vault: string, title: string) {
  const keys = detectFrontmatterConvention(vault);
  const filename = `${slugify(title)}.md`;
  const filePath = join(vault, filename);

  if (existsSync(filePath)) {
    console.error(JSON.stringify({ error: "note-exists", message: `${filePath} already exists.` }, null, 2));
    process.exit(1);
  }

  const frontmatterLines = keys.map((k) => {
    if (k === "title") return `title: "${title}"`;
    if (k === "created") return `created: ${new Date().toISOString().slice(0, 10)}`;
    if (k === "tags") return `tags: []`;
    return `${k}: `;
  });

  const content = `---\n${frontmatterLines.join("\n")}\n---\n\n# ${title}\n\n`;
  writeFileSync(filePath, content, "utf-8");

  console.log(JSON.stringify({ file: filePath, frontmatterKeys: keys }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.audit) runAudit(args.vault);
  else if (args.newNote) createNewNote(args.vault, args.title!);
}

main();
