#!/usr/bin/env bun
/**
 * migration/scripts/run.ts
 *
 * --generate produces timestamped up/down SQL migration file pairs from
 * structured change descriptors. --validate checks an existing migrations
 * directory for missing pairs or timestamp collisions. Never executes SQL.
 */

import { parseArgs } from "util";
import { readdirSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface MigrationArgs {
  generate: boolean;
  validate: boolean;
  name?: string;
  addColumn: string[];
  dropColumn: string[];
  createTable: string[];
  addIndex: string[];
  outputDir?: string;
  scope?: string;
}

function parseCliArgs(): MigrationArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      generate: { type: "boolean", default: false },
      validate: { type: "boolean", default: false },
      name: { type: "string" },
      "add-column": { type: "string", multiple: true },
      "drop-column": { type: "string", multiple: true },
      "create-table": { type: "string", multiple: true },
      "add-index": { type: "string", multiple: true },
      "output-dir": { type: "string" },
      scope: { type: "string" },
    },
  });

  if (!values.generate && !values.validate) {
    console.error("Error: one of --generate or --validate is required");
    process.exit(1);
  }
  if (values.generate) {
    if (!values.name) {
      console.error("Error: --name is required with --generate");
      process.exit(1);
    }
    if (!values["output-dir"]) {
      console.error("Error: --output-dir is required with --generate");
      process.exit(1);
    }
    const hasChange = values["add-column"] || values["drop-column"] || values["create-table"] || values["add-index"];
    if (!hasChange) {
      console.error("Error: at least one of --add-column, --drop-column, --create-table, --add-index is required with --generate");
      process.exit(1);
    }
  }
  if (values.validate && !values.scope) {
    console.error("Error: --scope is required with --validate");
    process.exit(1);
  }

  return {
    generate: values.generate as boolean,
    validate: values.validate as boolean,
    name: values.name as string | undefined,
    addColumn: (values["add-column"] as string[] | undefined) ?? [],
    dropColumn: (values["drop-column"] as string[] | undefined) ?? [],
    createTable: (values["create-table"] as string[] | undefined) ?? [],
    addIndex: (values["add-index"] as string[] | undefined) ?? [],
    outputDir: values["output-dir"] as string | undefined,
    scope: values.scope as string | undefined,
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildMigration(args: MigrationArgs): { up: string; down: string; manualReviewRequired: boolean } {
  const upLines: string[] = [];
  const downLines: string[] = [];
  let manualReviewRequired = false;

  for (const spec of args.addColumn) {
    const [table, colSpec] = spec.split(".");
    const [col, type] = colSpec.split(":");
    upLines.push(`ALTER TABLE ${table} ADD COLUMN ${col} ${type ?? "text"};`);
    downLines.push(`ALTER TABLE ${table} DROP COLUMN ${col};`);
  }

  for (const spec of args.dropColumn) {
    const [table, col] = spec.split(".");
    upLines.push(`ALTER TABLE ${table} DROP COLUMN ${col};`);
    downLines.push(`-- MANUAL REVIEW REQUIRED: original type/constraints for ${table}.${col} are unknown; cannot safely re-add.`);
    manualReviewRequired = true;
  }

  for (const spec of args.createTable) {
    const m = spec.match(/^(\w+)\((.+)\)$/);
    if (m) {
      const [, table, cols] = m;
      upLines.push(`CREATE TABLE ${table} (\n  ${cols.split(",").map((c) => c.trim()).join(",\n  ")}\n);`);
      downLines.push(`DROP TABLE ${table};`);
    }
  }

  for (const spec of args.addIndex) {
    const [table, col] = spec.split(".");
    const idxName = `idx_${table}_${col}`;
    upLines.push(`CREATE INDEX ${idxName} ON ${table}(${col});`);
    downLines.push(`DROP INDEX ${idxName};`);
  }

  return { up: upLines.join("\n") + "\n", down: downLines.join("\n") + "\n", manualReviewRequired };
}

function generate(args: MigrationArgs) {
  const ts = Math.floor(Date.now() / 1000);
  const slug = slugify(args.name!);
  const upFile = join(args.outputDir!, `${ts}_${slug}.up.sql`);
  const downFile = join(args.outputDir!, `${ts}_${slug}.down.sql`);

  if (!existsSync(args.outputDir!)) mkdirSync(args.outputDir!, { recursive: true });

  const { up, down, manualReviewRequired } = buildMigration(args);
  writeFileSync(upFile, up, "utf-8");
  writeFileSync(downFile, down, "utf-8");

  console.log(JSON.stringify({ upFile, downFile, manualReviewRequired }, null, 2));
}

function validate(scope: string) {
  const files = readdirSync(scope).filter((f) => /\.(up|down)\.sql$/.test(f));
  const byTimestamp = new Map<string, { up: boolean; down: boolean; files: string[] }>();

  for (const f of files) {
    const m = f.match(/^(\d+)_.+\.(up|down)\.sql$/);
    if (!m) continue;
    const [, ts, kind] = m;
    const entry = byTimestamp.get(ts) ?? { up: false, down: false, files: [] };
    entry.files.push(f);
    if (kind === "up") entry.up = true;
    if (kind === "down") entry.down = true;
    byTimestamp.set(ts, entry);
  }

  const issues: { issue: string; files: string[] }[] = [];
  for (const [ts, entry] of byTimestamp.entries()) {
    if (!entry.up) issues.push({ issue: `Timestamp ${ts} has a down migration but no matching up migration.`, files: entry.files });
    if (!entry.down) issues.push({ issue: `Timestamp ${ts} has an up migration but no matching down migration.`, files: entry.files });
  }

  // Duplicate timestamp detection: more than one distinct base slug sharing a timestamp.
  const slugsByTs = new Map<string, Set<string>>();
  for (const f of files) {
    const m = f.match(/^(\d+)_(.+)\.(up|down)\.sql$/);
    if (!m) continue;
    const [, ts, slug] = m;
    const set = slugsByTs.get(ts) ?? new Set();
    set.add(slug);
    slugsByTs.set(ts, set);
  }
  for (const [ts, slugs] of slugsByTs.entries()) {
    if (slugs.size > 1) {
      issues.push({ issue: `Timestamp ${ts} is used by multiple distinct migrations (collision).`, files: [...slugs] });
    }
  }

  console.log(JSON.stringify({ filesChecked: files.length, issues }, null, 2));
}

function main() {
  const args = parseCliArgs();
  if (args.generate) generate(args);
  else if (args.validate) validate(args.scope!);
}

main();
