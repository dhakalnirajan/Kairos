#!/usr/bin/env bun
/**
 * design-to-code/scripts/run.ts
 *
 * Converts a JSON component-tree spec into a Vue 3 + TypeScript single-file
 * component skeleton (script setup, template, scoped style placeholders).
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface ComponentSpec {
  name: string;
  props?: Record<string, string | number | boolean>;
  children?: (ComponentSpec | string)[];
}

interface DtcArgs {
  spec: string;
  output: string;
  force: boolean;
}

function parseCliArgs(): DtcArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      spec: { type: "string" },
      output: { type: "string" },
      force: { type: "boolean", default: false },
    },
  });
  if (!values.spec) {
    console.error("Error: --spec is required");
    process.exit(1);
  }
  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }
  return { spec: values.spec as string, output: values.output as string, force: values.force as boolean };
}

function loadSpec(path: string): ComponentSpec {
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw);
}

function inferType(value: unknown): string {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && /^\d+$/.test(value)) return "number";
  return "string";
}

function isCustomComponent(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function renderTemplate(spec: ComponentSpec | string, indent = 2): string {
  if (typeof spec === "string") {
    return " ".repeat(indent) + spec;
  }
  const tag = isCustomComponent(spec.name) ? toKebab(spec.name) : spec.name;
  const propsAttr = spec.props
    ? Object.entries(spec.props)
        .map(([k, v]) => ` :${k}="${k}"`)
        .join("")
    : "";
  const pad = " ".repeat(indent);
  if (!spec.children || spec.children.length === 0) {
    return `${pad}<${tag}${propsAttr} />`;
  }
  const childLines = spec.children.map((c) => renderTemplate(c, indent + 2)).join("\n");
  return `${pad}<${tag}${propsAttr}>\n${childLines}\n${pad}</${tag}>`;
}

function collectComponentNames(spec: ComponentSpec | string, acc: Set<string> = new Set()): Set<string> {
  if (typeof spec === "string") return acc;
  acc.add(spec.name);
  for (const c of spec.children ?? []) collectComponentNames(c, acc);
  return acc;
}

function buildSFC(spec: ComponentSpec): { sfc: string; propsInferred: string[] } {
  const props = spec.props ?? {};
  const propEntries = Object.entries(props);
  const propsInferred = propEntries.map(([k, v]) => `${k}: ${inferType(v)}`);

  const propsInterface = propEntries.length
    ? `interface Props {\n${propEntries.map(([k, v]) => `  ${k}: ${inferType(v)};`).join("\n")}\n}\n\nconst props = defineProps<Props>();`
    : `// No props inferred from spec.`;

  const template = renderTemplate(spec, 2);
  const componentNames = [...collectComponentNames(spec)];
  const styleBlocks = componentNames
    .map((name) => `.${toKebab(name)} {\n}`)
    .join("\n\n");

  const sfc = `<script setup lang="ts">
${propsInterface}
</script>

<template>
${template}
</template>

<style scoped>
${styleBlocks}
</style>
`;

  return { sfc, propsInferred };
}

function main() {
  const args = parseCliArgs();
  if (existsSync(args.output) && !args.force) {
    console.error(JSON.stringify({ error: "output-exists", message: `${args.output} already exists. Use --force to overwrite.` }, null, 2));
    process.exit(1);
  }

  const spec = loadSpec(args.spec);
  const { sfc, propsInferred } = buildSFC(spec);
  writeFileSync(args.output, sfc, "utf-8");

  const componentCount = collectComponentNames(spec).size;
  console.log(JSON.stringify({ output: args.output, componentCount, propsInferred }, null, 2));
}

main();
