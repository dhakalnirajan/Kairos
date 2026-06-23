import { describe, test, expect } from "bun:test";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { ASTNavigator } from "../src/tools/analysis/ast.ts";
import { CodemodEngine, createCodemodTool } from "../src/tools/analysis/codemod.ts";

describe("ASTNavigator", () => {
  const testDir = join(process.cwd(), "_test_ast_navigator");
  const filePath = join(testDir, "example.ts");

  test("scans file and collects symbols and dependencies", async () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      filePath,
      `import { other } from './other';

export function used() {
  return other;
}

function unused() {
  return 42;
}

const hidden = 'value';
export { hidden };
`,
      "utf-8",
    );

    const navigator = new ASTNavigator();
    await navigator.scanFile(filePath);

    const symbols = navigator.findSymbol("used");
    expect(symbols.length).toBe(1);
    expect(symbols[0]?.type).toBe("function");

    const dependency = navigator.getDependencies(filePath);
    expect(dependency.length).toBe(1);
    expect(dependency[0]?.type).toBe("import");
    expect(dependency[0]?.to).toBe("./other");

    const deadCode = navigator.findDeadCode();
    expect(deadCode.some((entry) => entry.symbol.name === "unused")).toBe(true);
  });

  test("scanDirectory includes nested code files", async () => {
    const nestedDir = join(testDir, "nested");
    const nestedFile = join(nestedDir, "nested.ts");
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(nestedFile, `export const value = 1;`, "utf-8");

    const navigator = new ASTNavigator();
    await navigator.scanDirectory(testDir);

    const symbols = navigator.findSymbol("value");
    expect(symbols.length).toBeGreaterThanOrEqual(1);
    expect(symbols[0]?.exported).toBe(true);
  });

  test("cleans up temporary test directory", () => {
    rmSync(testDir, { recursive: true, force: true });
  });
});

describe("CodemodEngine", () => {
  const testDir = join(process.cwd(), "_test_codemod");
  const filePath = join(testDir, "rewrite.ts");

  test("rename operation produces a diff and metadata", async () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(
      filePath,
      `function oldName() {
  return 1;
}

console.log(oldName());
`,
      "utf-8",
    );

    const engine = new CodemodEngine();
    const result = await engine.applyTransform(filePath, {
      type: "rename",
      target: "oldName",
      replacement: "newName",
      file: filePath,
    });

    expect(result.formattedDiff).toContain("+ console.log(newName());");
    expect(result.affectedFiles).toEqual([filePath]);
    expect(result.symbolsModified).toBeGreaterThan(0);
  });

  test("extract operation replaces a block of lines", async () => {
    writeFileSync(
      filePath,
      `function greet() {
  console.log('hello');
  console.log('world');
}
`,
      "utf-8",
    );

    const engine = new CodemodEngine();
    const result = await engine.applyTransform(filePath, {
      type: "extract",
      target: "greet",
      replacement: "function greet() { return sayHello(); }",
      startLine: 1,
      endLine: 3,
      file: filePath,
    });

    expect(result.formattedDiff).toContain(
      "+ function greet() { return sayHello(); }",
    );
    expect(result.diff.stats.deletions).toBeGreaterThan(0);
  });

  test("createCodemodTool executes transform and returns metadata", async () => {
    const tool = createCodemodTool();
    const result = await tool.execute(
      {
        file: filePath,
        operation: {
          type: "rename",
          target: "oldName",
          replacement: "newName",
        },
      },
      { workspaceRoot: process.cwd() },
    );

    expect(result.success).toBe(true);
    expect(result.metadata).toBeDefined();
    expect(result.metadata?.stats).toBeDefined();
  });

  test("cleans up temporary test directory", () => {
    rmSync(testDir, { recursive: true, force: true });
  });
});
