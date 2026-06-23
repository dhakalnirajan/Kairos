#!/usr/bin/env bun
/**
 * code-generation/scripts/run.ts
 *
 * Scaffolds new source files from a fixed set of templates: ts-function,
 * ts-class, route-handler, vue-component. Generated implementations always
 * throw "not implemented" rather than fabricating logic.
 */

import { parseArgs } from "util";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

type Template = "ts-function" | "ts-class" | "route-handler" | "vue-component";

interface CodegenArgs {
  template: Template;
  name: string;
  output: string;
  method: string;
  path?: string;
  force: boolean;
  noTest: boolean;
}

const VALID_TEMPLATES: Template[] = ["ts-function", "ts-class", "route-handler", "vue-component"];

function parseCliArgs(): CodegenArgs {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      template: { type: "string" },
      name: { type: "string" },
      output: { type: "string" },
      method: { type: "string", default: "GET" },
      path: { type: "string" },
      force: { type: "boolean", default: false },
      "no-test": { type: "boolean", default: false },
    },
  });

  if (!values.template || !VALID_TEMPLATES.includes(values.template as Template)) {
    console.error(`Error: --template must be one of: ${VALID_TEMPLATES.join(", ")}`);
    process.exit(1);
  }
  if (!values.name) {
    console.error("Error: --name is required");
    process.exit(1);
  }
  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  return {
    template: values.template as Template,
    name: values.name as string,
    output: values.output as string,
    method: ((values.method as string) ?? "GET").toUpperCase(),
    path: values.path as string | undefined,
    force: values.force as boolean,
    noTest: values["no-test"] as boolean,
  };
}

function toCamelCase(name: string): string {
  const words = name.replace(/[-_]/g, " ").split(/(?=[A-Z])|\s+/).filter(Boolean);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function renderTsFunction(name: string): string {
  const fnName = toCamelCase(name);
  return `export function ${fnName}() {
  // TODO: implement ${fnName}
  throw new Error("not implemented");
}
`;
}

function renderTsClass(name: string): string {
  const className = toPascalCase(name);
  return `export class ${className} {
  constructor() {
    // TODO: implement ${className} constructor
  }

  // TODO: implement ${className} methods
}
`;
}

function renderRouteHandler(name: string, method: string, path?: string): string {
  const fnName = toCamelCase(name);
  const routePath = path ?? `/api/${toKebabCase(name)}`;
  return `import type { Request, Response } from "express";

export const ${fnName} = async (req: Request, res: Response): Promise<void> => {
  // TODO: implement ${fnName}
  // Route: ${method} ${routePath}
  throw new Error("not implemented");
};
`;
}

function renderVueComponent(name: string): string {
  const componentName = toPascalCase(name);
  return `<script setup lang="ts">
// TODO: implement ${componentName} props and logic
</script>

<template>
  <div class="${toKebabCase(componentName)}">
    <!-- TODO: implement ${componentName} template -->
  </div>
</template>

<style scoped>
.${toKebabCase(componentName)} {
}
</style>
`;
}

function renderTestStub(template: Template, name: string, outputExt: string): string {
  const fnName = toCamelCase(name);
  if (outputExt === ".vue") {
    return `import { describe, it, expect } from "vitest";
// TODO: import mount utilities and the component under test

describe("${toPascalCase(name)}", () => {
  it.todo("renders correctly");
});
`;
  }
  return `import { describe, it, expect } from "vitest";

describe("${fnName}", () => {
  it.todo("implements expected behavior");
});
`;
}

function generate(args: CodegenArgs): string {
  switch (args.template) {
    case "ts-function":
      return renderTsFunction(args.name);
    case "ts-class":
      return renderTsClass(args.name);
    case "route-handler":
      return renderRouteHandler(args.name, args.method, args.path);
    case "vue-component":
      return renderVueComponent(args.name);
  }
}

function testFilePath(output: string): string {
  const ext = output.match(/\.[^.]+$/)?.[0] ?? "";
  const base = output.slice(0, -ext.length);
  return ext === ".vue" ? `${base}.test.ts` : `${base}.test${ext}`;
}

function main() {
  const args = parseCliArgs();

  if (existsSync(args.output) && !args.force) {
    console.error(JSON.stringify({ error: "output-exists", message: `${args.output} already exists. Use --force to overwrite.` }, null, 2));
    process.exit(1);
  }

  const content = generate(args);
  const dir = dirname(args.output);
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(args.output, content, "utf-8");

  let testFile: string | null = null;
  if (!args.noTest) {
    testFile = testFilePath(args.output);
    if (!existsSync(testFile) || args.force) {
      const ext = args.output.match(/\.[^.]+$/)?.[0] ?? "";
      writeFileSync(testFile, renderTestStub(args.template, args.name, ext), "utf-8");
    }
  }

  console.log(JSON.stringify({ output: args.output, testFile, template: args.template }, null, 2));
}

main();
