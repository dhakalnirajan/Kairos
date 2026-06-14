import type { ToolInstance, ToolContext, ToolResult } from '../types/tools.ts';

export interface ToolNode {
  id: string;
  name: string;
  params: Record<string, unknown>;
  dependencies: string[];
}

export interface ExecutionPlan {
  levels: ToolNode[][];
  dag: string;
}

export function buildExecutionPlan(tools: ToolNode[]): ExecutionPlan {
  const nodeMap = new Map<string, ToolNode>();
  for (const node of tools) {
    nodeMap.set(node.id, node);
  }

  const visited = new Set<string>();
  const levels: ToolNode[][] = [];
  let remaining = new Set(tools.map((t) => t.id));

  while (remaining.size > 0) {
    const level: ToolNode[] = [];

    for (const id of remaining) {
      const node = nodeMap.get(id);
      if (!node) continue;
      if (node.dependencies.every((dep) => visited.has(dep))) {
        level.push(node);
      }
    }

    if (level.length === 0) {
      return { levels: [], dag: 'Error: Circular dependency detected' };
    }

    for (const node of level) {
      visited.add(node.id);
      remaining.delete(node.id);
    }

    levels.push(level);
  }

  return { levels, dag: renderAsciiDag(levels) };
}

function renderAsciiDag(levels: ToolNode[][]): string {
  const lines: string[] = ['Execution DAG:', ''];

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const isLastLevel = i === levels.length - 1;
    const prefix = isLastLevel ? '└── ' : '├── ';
    const connector = isLastLevel ? '    ' : '│   ';

    if (level.length === 1) {
      const node = level[0]!;
      const depStr = node.dependencies.length > 0 ? ` (depends: ${node.dependencies.join(', ')})` : '';
      lines.push(`${prefix}${node.name} [${node.id}]${depStr}`);
    } else {
      lines.push(`${prefix}Level ${i} (${level.length} parallel):`);
      for (let j = 0; j < level.length; j++) {
        const node = level[j]!;
        const isLast = j === level.length - 1;
        const nodePrefix = isLast ? '└── ' : '├── ';
        const depStr = node.dependencies.length > 0 ? ` (depends: ${node.dependencies.join(', ')})` : '';
        lines.push(`${connector}${nodePrefix}${node.name} [${node.id}]${depStr}`);
      }
    }
  }

  return lines.join('\n');
}

export function validateDependencies(tools: ToolNode[]): string[] {
  const errors: string[] = [];
  const ids = new Set(tools.map((t) => t.id));

  for (const node of tools) {
    for (const dep of node.dependencies) {
      if (!ids.has(dep)) {
        errors.push(`Tool "${node.id}" depends on unknown tool "${dep}"`);
      }
    }
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(id: string): boolean {
    if (inStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    inStack.add(id);

    const node = tools.find((t) => t.id === id);
    if (node) {
      for (const dep of node.dependencies) {
        if (dfs(dep)) {
          errors.push(`Circular dependency involving "${id}" -> "${dep}"`);
          return true;
        }
      }
    }

    inStack.delete(id);
    return false;
  }

  for (const tool of tools) {
    dfs(tool.id);
  }

  return errors;
}

export const parallelTool: ToolInstance = {
  name: 'parallel',
  description: 'Resolve dependency graphs and schedule concurrent tool execution with ASCII DAG visualization',
  parameters: {
    type: 'object',
    properties: {
      tools: {
        type: 'array',
        description: 'Array of tool definitions with id, name, params, and optional dependencies',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique tool identifier' },
            name: { type: 'string', description: 'Tool name to execute' },
            params: { type: 'object', description: 'Tool parameters' },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs of tools this depends on',
            },
          },
          required: ['id', 'name', 'params'],
        },
      },
      maxConcurrent: { type: 'number', description: 'Max concurrent executions per level (default 4)' },
    },
    required: ['tools'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const toolDefs = (params['tools'] as Array<Record<string, unknown>>)?.map((t) => ({
      id: String(t['id'] ?? ''),
      name: String(t['name'] ?? ''),
      params: (t['params'] as Record<string, unknown>) ?? {},
      dependencies: ((t['dependencies'] as string[]) ?? []),
    })) ?? [];

    if (toolDefs.length === 0) {
      return { success: false, output: '', error: 'No tools provided' };
    }

    const validationErrors = validateDependencies(toolDefs);
    if (validationErrors.length > 0) {
      return {
        success: false,
        output: '',
        error: validationErrors.join('\n'),
      };
    }

    const plan = buildExecutionPlan(toolDefs);
    const maxParallel = plan.levels.length > 0
      ? Math.max(...plan.levels.map((l) => l.length))
      : 0;

    return {
      success: true,
      output: plan.dag,
      metadata: {
        levels: plan.levels.length,
        totalTools: toolDefs.length,
        maxParallel,
        executionGroups: plan.levels.map((level) => level.map((n) => n.id)),
      },
    };
  },
};
