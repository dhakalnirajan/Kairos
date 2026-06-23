#!/usr/bin/env bun
/**
 * design-md/scripts/run.ts
 *
 * Produces a structured Markdown design document from a problem statement
 * and proposed approach, with explicit alternatives/tradeoffs sections.
 * Never touches source code.
 */

import { parseArgs } from "util";
import { writeFileSync } from "fs";

interface DesignArgs {
  problem: string;
  approach: string;
  alts: string[];
  output?: string;
}

function parseCliArgs(): DesignArgs {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      problem: { type: "string" },
      approach: { type: "string" },
      alt: { type: "string", multiple: true },
      output: { type: "string" },
    },
    allowPositionals: true,
  });

  if (!values.problem) {
    console.error("Error: --problem is required");
    process.exit(1);
  }
  if (!values.approach) {
    console.error("Error: --approach is required");
    process.exit(1);
  }

  return {
    problem: values.problem as string,
    approach: values.approach as string,
    alts: (values.alt as string[] | undefined) ?? [],
    output: values.output as string | undefined,
  };
}

function buildDocument(args: DesignArgs): string {
  const lines: string[] = [];
  lines.push(`# Design Document`);
  lines.push("");
  lines.push(`## Problem`);
  lines.push(args.problem);
  lines.push("");
  lines.push(`## Goals`);
  lines.push("- _(fill in: what does success look like)_");
  lines.push("");
  lines.push(`## Non-Goals`);
  lines.push("- _(fill in: what is explicitly out of scope)_");
  lines.push("");
  lines.push(`## Proposed Approach`);
  lines.push(args.approach);
  lines.push("");
  lines.push(`## Alternatives Considered`);
  if (args.alts.length === 0) {
    lines.push("> **INCOMPLETE**: no alternatives were provided. A design with no documented alternatives has not demonstrated that other options were weighed. Add at least one via `--alt` before treating this document as final.");
  } else {
    args.alts.forEach((alt, i) => {
      lines.push(`### Alternative ${i + 1}`);
      lines.push(alt);
      lines.push("");
      lines.push("**Why not chosen:** _(fill in)_");
      lines.push("");
    });
  }
  lines.push(`## Tradeoffs`);
  lines.push("- _(fill in: what does the proposed approach give up relative to alternatives)_");
  lines.push("");
  lines.push(`## Open Questions`);
  lines.push("- _(fill in: anything unresolved before implementation starts)_");
  lines.push("");
  return lines.join("\n");
}

function main() {
  const args = parseCliArgs();
  const doc = buildDocument(args);

  if (args.output) {
    writeFileSync(args.output, doc, "utf-8");
    console.log(`Design document written to ${args.output}`);
  } else {
    console.log(doc);
  }
}

main();
