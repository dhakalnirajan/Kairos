import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { ASTNavigator } from '../ast.ts';

const navigator = new ASTNavigator();

export const astTool: ToolInstance = {
  name: 'ast_analysis',
  description: 'AST-based code analysis: scan directories, find symbols, dependencies, dead code, impact analysis',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['scan', 'find_symbol', 'dependencies', 'dead_code', 'impact', 'architecture'],
        description: 'Analysis action',
      },
      path: { type: 'string', description: 'Directory or file path' },
      symbol: { type: 'string', description: 'Symbol name' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const targetPath = String(params['path'] ?? ctx.workspaceRoot);
    const symbol = String(params['symbol'] ?? '');

    try {
      switch (action) {
        case 'scan': {
          await navigator.scanDirectory(targetPath);
          return { success: true, output: `Scanned ${targetPath}` };
        }
        case 'find_symbol': {
          if (!symbol) return { success: false, output: '', error: 'symbol required' };
          const symbols = navigator.findSymbol(symbol);
          const output = symbols.map((s) => `${s.type.padEnd(12)} ${s.name.padEnd(30)} ${s.file}:${s.line}`).join('\n');
          return { success: true, output: output || `No symbols matching "${symbol}"`, metadata: { count: symbols.length } };
        }
        case 'dependencies': {
          const deps = navigator.getDependencies(targetPath);
          const output = deps.map((d) => `${d.from} --[${d.type}]--> ${d.to}`).join('\n');
          return { success: true, output: output || 'No dependencies', metadata: { count: deps.length } };
        }
        case 'dead_code': {
          const deadCode = navigator.findDeadCode();
          const output = deadCode.length > 0
            ? deadCode.map((d) => `${d.symbol.name} (${d.symbol.type}) in ${d.file}: ${d.reason}`).join('\n')
            : 'No dead code detected';
          return { success: true, output, metadata: { count: deadCode.length } };
        }
        case 'impact': {
          if (!symbol) return { success: false, output: '', error: 'symbol required' };
          const affected = navigator.getImpactAnalysis(symbol);
          const output = affected.length > 0
            ? `Impact of "${symbol}":\n${affected.map((f) => `  - ${f}`).join('\n')}`
            : `No dependents found for "${symbol}"`;
          return { success: true, output, metadata: { count: affected.length } };
        }
        case 'architecture': {
          const arch = navigator.getArchitecture();
          const output = [
            `Architecture: ${arch.nodes.length} nodes, ${arch.edges.length} edges`,
            '',
            'Nodes:',
            ...arch.nodes.slice(0, 30).map((n) => `  ${n}`),
            arch.nodes.length > 30 ? `  ... and ${arch.nodes.length - 30} more` : '',
            '',
            'Edges:',
            ...arch.edges.slice(0, 20).map((e) => `  ${e.from} --> ${e.to}`),
            arch.edges.length > 20 ? `  ... and ${arch.edges.length - 20} more` : '',
          ].join('\n');
          return { success: true, output, metadata: { nodes: arch.nodes.length, edges: arch.edges.length } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `AST analysis failed: ${e}` };
    }
  },
};
