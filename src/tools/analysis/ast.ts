import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface ASTNode {
  type: string;
  name?: string;
  start: number;
  end: number;
  children: ASTNode[];
  imports?: string[];
  exports?: string[];
}

export interface CodeSymbol {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "export";
  file: string;
  line: number;
  column: number;
  exported?: boolean;
}

export interface Dependency {
  from: string;
  to: string;
  type: 'import' | 'export' | 'reference';
}

export class ASTNavigator {
  private files: Map<string, string> = new Map();
  private symbols: Map<string, CodeSymbol[]> = new Map();
  private dependencies: Map<string, Dependency[]> = new Map();

  async scanDirectory(dir: string): Promise<void> {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (
        stat.isDirectory() &&
        !entry.startsWith(".") &&
        entry !== "node_modules"
      ) {
        await this.scanDirectory(fullPath);
      } else if (this.isCodeFile(entry)) {
        await this.scanFileEntry(fullPath);
      }
    }
  }

  public async scanFile(filePath: string): Promise<void> {
    if (!this.isCodeFile(filePath)) return;
    await this.scanFileEntry(filePath);
  }

  private isCodeFile(filename: string): boolean {
    const ext = extname(filename);
    return [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"].includes(ext);
  }

  private async scanFileEntry(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, "utf-8");
      this.files.set(filePath, content);
      this.extractSymbols(filePath, content);
      this.extractDependencies(filePath, content);
    } catch {}
  }

  private extractSymbols(filePath: string, content: string): void {
    const symbols: CodeSymbol[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      const funcMatch = line.match(
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      );
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1]!,
          type: "function",
          file: filePath,
          line: i + 1,
          column: 0,
        });
      }

      const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1]!,
          type: "class",
          file: filePath,
          line: i + 1,
          column: 0,
        });
      }

      const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
      if (interfaceMatch) {
        symbols.push({
          name: interfaceMatch[1]!,
          type: "interface",
          file: filePath,
          line: i + 1,
          column: 0,
        });
      }

      const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)/);
      if (typeMatch) {
        symbols.push({
          name: typeMatch[1]!,
          type: "type",
          file: filePath,
          line: i + 1,
          column: 0,
        });
      }

      const constMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/);
      if (constMatch) {
        symbols.push({
          name: constMatch[1]!,
          type: "variable",
          file: filePath,
          line: i + 1,
          column: 0,
          exported: /\bexport\b/.test(line),
        });
      }

      const exportListMatch = line.match(/export\s*{\s*([^}]+)\s*}/);
      if (exportListMatch) {
        const names = exportListMatch[1]!
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean);
        for (const name of names) {
          symbols.push({
            name,
            type: "export",
            file: filePath,
            line: i + 1,
            column: 0,
            exported: true,
          });
        }
      }
    }

    this.symbols.set(filePath, symbols);
  }

  private extractDependencies(filePath: string, content: string): void {
    const deps: Dependency[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const importMatch = line.match(/import\s+.*from\s+['"](.+?)['"]/);
      if (importMatch) {
        deps.push({
          from: filePath,
          to: importMatch[1]!,
          type: "import",
        });
      }

      const exportMatch = line.match(/export\s+.*from\s+['"](.+?)['"]/);
      if (exportMatch) {
        deps.push({
          from: filePath,
          to: exportMatch[1]!,
          type: "export",
        });
      }
    }

    this.dependencies.set(filePath, deps);
  }

  findSymbol(name: string): CodeSymbol[] {
    const results: CodeSymbol[] = [];
    for (const symbols of this.symbols.values()) {
      for (const symbol of symbols) {
        if (symbol.name === name) {
          results.push(symbol);
        }
      }
    }
    return results;
  }

  getDependencies(filePath: string): Dependency[] {
    return this.dependencies.get(filePath) ?? [];
  }

  findDeadCode(): Array<{ file: string; symbol: CodeSymbol; reason: string }> {
    const deadCode: Array<{
      file: string;
      symbol: CodeSymbol;
      reason: string;
    }> = [];
    const allExports = new Set<string>();

    for (const symbols of this.symbols.values()) {
      for (const symbol of symbols) {
        if (symbol.type === "export" || symbol.exported) {
          allExports.add(symbol.name);
        }
      }
    }

    for (const [file, symbols] of this.symbols) {
      for (const symbol of symbols) {
        if (symbol.type === "function" || symbol.type === "class") {
          const isUsed = this.isSymbolUsed(symbol.name, file);
          if (!isUsed && !allExports.has(symbol.name)) {
            deadCode.push({
              file,
              symbol,
              reason: `Symbol '${symbol.name}' is not used anywhere`,
            });
          }
        }
      }
    }

    return deadCode;
  }

  private isSymbolUsed(name: string, excludeFile: string): boolean {
    for (const [file, content] of this.files) {
      if (file === excludeFile) continue;
      const regex = new RegExp(`\\b${name}\\b`);
      if (regex.test(content)) return true;
    }
    return false;
  }

  getArchitecture(): {
    nodes: string[];
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes = Array.from(
      new Set([
        ...this.files.keys(),
        ...Array.from(this.symbols.values()).flatMap((symbols) =>
          symbols.map((symbol) => symbol.name),
        ),
      ]),
    );

    const edges: Array<{ from: string; to: string }> = [];
    for (const deps of this.dependencies.values()) {
      for (const dep of deps) {
        edges.push({ from: dep.from, to: dep.to });
      }
    }

    return { nodes, edges };
  }

  getImpactAnalysis(symbolName: string): string[] {
    const affected: string[] = [];
    const symbols = this.findSymbol(symbolName);

    for (const symbol of symbols) {
      for (const [file, deps] of this.dependencies) {
        for (const dep of deps) {
          if (dep.to.includes(symbol.file) || dep.to.includes(symbolName)) {
            affected.push(file);
          }
        }
      }
    }

    return [...new Set(affected)];
  }
}
