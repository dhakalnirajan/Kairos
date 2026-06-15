import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dependencyGraphTool: ToolInstance = {
  name: 'dependency_graph',
  description: 'Dependency awareness: import graph parsing, circular dependency detection, refactoring verification, ASCII visualisation',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['parse', 'detect_cycles', 'visualise', 'verify_refactor', 'impact_of_change'], description: 'Graph action' },
      path: { type: 'string', description: 'File or directory' },
      symbol: { type: 'string', description: 'Symbol for impact analysis' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const targetPath = String(params['path'] ?? ctx.workspaceRoot);

    try {
      const { readdirSync } = require('fs');
      const deps = new Map<string, Set<string>>();

      function parseImports(filePath: string): string[] {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const imports: string[] = [];
          const importMatches = content.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g);
          for (const m of importMatches) imports.push(m[1]!);
          const requireMatches = content.matchAll(/require\(['"]([^'"]+)['"]\)/g);
          for (const m of requireMatches) imports.push(m[1]!);
          return imports;
        } catch { return []; }
      }

      function buildGraph(dir: string, depth = 0): void {
        if (depth > 6) return;
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
              buildGraph(full, depth + 1);
            } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
              const rel = full.replace(ctx.workspaceRoot + '/', '');
              const imports = parseImports(full).filter((i) => i.startsWith('.') || i.startsWith('@'));
              deps.set(rel, new Set(imports));
            }
          }
        } catch {}
      }
      buildGraph(targetPath);

      switch (action) {
        case 'parse': {
          const output = Array.from(deps.entries()).map(([file, imports]) => `${file} → [${Array.from(imports).join(', ')}]`).join('\n');
          return { success: true, output: output || 'No dependencies found', metadata: { files: deps.size } };
        }
        case 'detect_cycles': {
          const visited = new Set<string>();
          const inStack = new Set<string>();
          const cycles: string[][] = [];

          function dfs(node: string, path: string[]): void {
            if (inStack.has(node)) {
              const cycleStart = path.indexOf(node);
              if (cycleStart >= 0) cycles.push(path.slice(cycleStart).concat(node));
              return;
            }
            if (visited.has(node)) return;
            visited.add(node);
            inStack.add(node);
            const imports = deps.get(node) ?? new Set();
            for (const imp of imports) {
              const resolved = imp.startsWith('.') ? join(node, '..', imp) : imp;
              dfs(resolved, [...path, node]);
            }
            inStack.delete(node);
          }

          for (const file of deps.keys()) dfs(file, []);
          const output = cycles.length > 0
            ? `Circular dependencies found:\n${cycles.map((c) => c.join(' → ')).join('\n')}`
            : 'No circular dependencies detected';
          return { success: cycles.length === 0, output, metadata: { cycles: cycles.length } };
        }
        case 'visualise': {
          const nodes = Array.from(deps.keys()).slice(0, 20);
          const edges: string[] = [];
          for (const [file, imports] of deps) {
            for (const imp of imports) {
              const short = imp.split('/').pop() ?? imp;
              edges.push(`${file.split('/').pop()} --> ${short}`);
            }
          }
          const output = `Dependency Graph (${deps.size} files):\n\nNodes:\n${nodes.map((n) => `  ${n}`).join('\n')}\n\nEdges (first 30):\n${edges.slice(0, 30).map((e) => `  ${e}`).join('\n')}`;
          return { success: true, output };
        }
        case 'verify_refactor': {
          const symbol = String(params['symbol'] ?? '');
          if (!symbol) return { success: false, output: '', error: 'symbol required' };
          const affected: string[] = [];
          for (const [file, imports] of deps) {
            for (const imp of imports) {
              if (imp.includes(symbol)) affected.push(file);
            }
          }
          return { success: true, output: affected.length > 0 ? `Files that may need updating:\n${affected.map((f) => `  • ${f}`).join('\n')}` : `No direct dependents of "${symbol}"`, metadata: { count: affected.length } };
        }
        case 'impact_of_change': {
          const symbol = String(params['symbol'] ?? '');
          if (!symbol) return { success: false, output: '', error: 'symbol required' };
          const affected = new Set<string>();
          const queue = [symbol];
          while (queue.length > 0) {
            const current = queue.shift()!;
            for (const [file, imports] of deps) {
              if (imports.has(current) && !affected.has(file)) {
                affected.add(file);
                queue.push(file);
              }
            }
          }
          return { success: true, output: affected.size > 0 ? `Impact of changing "${symbol}":\n${Array.from(affected).map((f) => `  • ${f}`).join('\n')}` : `No impact for "${symbol}"`, metadata: { count: affected.size } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Dependency graph failed: ${e}` };
    }
  },
};
