import { readFileSync } from 'fs';
import { isAbsolute, join } from "path";
import { ASTNavigator, type CodeSymbol } from "./ast.ts";
import { computeDiff, formatDiff, type DiffResult } from './diff.ts';

export interface TransformOperation {
  type: 'rename' | 'extract' | 'inline';
  target: string;
  replacement?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
}

export interface CodemodResult {
  operation: TransformOperation;
  diff: DiffResult;
  formattedDiff: string;
  affectedFiles: string[];
  symbolsModified: number;
}

export class CodemodEngine {
  private navigator: ASTNavigator;

  constructor() {
    this.navigator = new ASTNavigator();
  }

  async applyTransform(file: string, operation: TransformOperation): Promise<CodemodResult> {
    const normalizedPath = isAbsolute(file) ? file : join(process.cwd(), file);
    const content = readFileSync(normalizedPath, "utf-8");
    let newContent: string;

    switch (operation.type) {
      case 'rename':
        newContent = this.applyRename(content, operation);
        break;
      case 'extract':
        newContent = this.applyExtract(content, operation);
        break;
      case 'inline':
        newContent = this.applyInline(content, operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    const diff = computeDiff(content, newContent);
    const symbolsModified = this.countSymbolChanges(content, newContent);

    return {
      operation,
      diff,
      formattedDiff: formatDiff(diff),
      affectedFiles: [file],
      symbolsModified,
    };
  }

  private applyRename(content: string, op: TransformOperation): string {
    if (!op.target || !op.replacement) {
      throw new Error('Rename requires target and replacement');
    }
    const regex = new RegExp(`\\b${op.target}\\b`, 'g');
    return content.replace(regex, op.replacement);
  }

  private applyExtract(content: string, op: TransformOperation): string {
    if (!op.startLine || !op.endLine || !op.replacement) {
      throw new Error('Extract requires startLine, endLine, and replacement');
    }
    const lines = content.split('\n');
    const extractedCode = lines.slice(op.startLine - 1, op.endLine).join('\n');

    lines.splice(op.startLine - 1, op.endLine - op.startLine + 1, op.replacement);

    return lines.join('\n');
  }

  private applyInline(content: string, op: TransformOperation): string {
    if (!op.target || !op.replacement) {
      throw new Error('Inline requires target and replacement');
    }
    const regex = new RegExp(`\\b${op.target}\\s*\\([^)]*\\)`, 'g');
    return content.replace(regex, op.replacement);
  }

  private countSymbolChanges(oldContent: string, newContent: string): number {
    const oldSymbols = this.extractSymbolNames(oldContent);
    const newSymbols = this.extractSymbolNames(newContent);

    let changes = 0;
    for (const sym of oldSymbols) {
      if (!newSymbols.includes(sym)) changes++;
    }
    for (const sym of newSymbols) {
      if (!oldSymbols.includes(sym)) changes++;
    }

    return changes;
  }

  private extractSymbolNames(content: string): string[] {
    const symbols: string[] = [];
    const patterns = [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
      /(?:export\s+)?class\s+(\w+)/g,
      /(?:export\s+)?interface\s+(\w+)/g,
      /(?:export\s+)?type\s+(\w+)/g,
      /(?:export\s+)?const\s+(\w+)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) symbols.push(match[1]);
      }
    }

    return symbols;
  }

  generateSummary(results: CodemodResult[]): string {
    const totalDiff = results.reduce(
      (acc, r) => ({
        additions: acc.additions + r.diff.stats.additions,
        deletions: acc.deletions + r.diff.stats.deletions,
      }),
      { additions: 0, deletions: 0 },
    );

    const affectedFiles = new Set(results.flatMap((r) => r.affectedFiles));
    const totalSymbols = results.reduce((acc, r) => acc + r.symbolsModified, 0);

    return [
      `Codemod Summary:`,
      `  Operations: ${results.length}`,
      `  Files affected: ${affectedFiles.size}`,
      `  Lines added: ${totalDiff.additions}`,
      `  Lines removed: ${totalDiff.deletions}`,
      `  Symbols modified: ${totalSymbols}`,
    ].join('\n');
  }
}

export function createCodemodTool() {
  return {
    name: 'codemod',
    description: 'Apply AST-based code transformations with diff generation',
    parameters: {
      type: 'object',
      properties: {
        file: { type: 'string', description: 'File to transform' },
        operation: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['rename', 'extract', 'inline'] },
            target: { type: 'string', description: 'Symbol or expression to transform' },
            replacement: { type: 'string', description: 'Replacement code' },
            startLine: { type: 'number', description: 'Start line for extract' },
            endLine: { type: 'number', description: 'End line for extract' },
          },
          required: ['type', 'target'],
        },
      },
      required: ['file', 'operation'],
    },
    riskLevel: 'write' as const,
    isIdempotent: false,
    execute: async (params: Record<string, unknown>, ctx: { workspaceRoot: string }) => {
      const file = params.file as string;
      const operation = params.operation as TransformOperation;

      try {
        const engine = new CodemodEngine();
        const result = await engine.applyTransform(file, operation);

        return {
          success: true,
          output: result.formattedDiff,
          metadata: {
            affectedFiles: result.affectedFiles,
            symbolsModified: result.symbolsModified,
            stats: result.diff.stats,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
