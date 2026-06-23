import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export interface WorkflowStep {
  id: string;
  name: string;
  tool: string;
  params: Record<string, unknown>;
  dependsOn?: string[];
  condition?: WorkflowCondition;
}

export interface WorkflowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'exists';
  value?: unknown;
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export function parseSimpleYaml(yaml: string): WorkflowDefinition {
  const lines = yaml.split('\n');
  let name = '';
  let description = '';
  const steps: WorkflowStep[] = [];

  let currentStep: Partial<WorkflowStep> | null = null;
  let stepIndent = 0;

  for (const rawLine of lines) {
    const trimmed = rawLine.trimEnd();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const line = trimmed.trimStart();

    if (indent === 0) {
      if (line.startsWith('name:')) {
        name = line.slice(5).trim().replace(/^["']|["']$/g, '');
      } else if (line.startsWith('description:')) {
        description = line.slice(12).trim().replace(/^["']|["']$/g, '');
      } else if (line === 'steps:') {
        stepIndent = indent;
      }
    } else if (indent > stepIndent && line.startsWith('- ')) {
      if (currentStep?.id) {
        steps.push(currentStep as WorkflowStep);
      }
      currentStep = { id: '', name: '', tool: '', params: {}, dependsOn: [] } as WorkflowStep;
      const kv = line.slice(2);
      const colonIdx = kv.indexOf(':');
      if (colonIdx > 0) {
        const key = kv.slice(0, colonIdx).trim();
        const val = kv.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key === 'id') currentStep.id = val;
        if (key === 'name') currentStep.name = val;
        if (key === 'tool') currentStep.tool = val;
      }
    } else if (currentStep && indent > stepIndent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

        if (key === 'id') currentStep.id = val;
        else if (key === 'name') currentStep.name = val;
        else if (key === 'tool') currentStep.tool = val;
        else if (key === 'dependsOn') {
          currentStep.dependsOn = val.split(',').map((s) => s.trim()).filter(Boolean);
        } else if (key === 'condition') {
          const parts = val.split(/\s+/);
          if (parts.length >= 2) {
            currentStep.condition = {
              field: parts[0]!,
              operator: (parts[1] as WorkflowCondition['operator']) ?? 'eq',
              value: parts[2],
            };
          }
        } else if (key.startsWith('param.')) {
          const paramKey = key.slice(6);
          if (!currentStep.params) currentStep.params = {};
          currentStep.params[paramKey] = val;
        }
      }
    }
  }

  if (currentStep?.id) {
    steps.push(currentStep as WorkflowStep);
  }

  return { name, description, steps };
}

export function evaluateCondition(condition: WorkflowCondition, context: Record<string, unknown>): boolean {
  const fieldValue = context[condition.field];

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'gt':
      return Number(fieldValue) > Number(condition.value);
    case 'lt':
      return Number(fieldValue) < Number(condition.value);
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return true;
  }
}

export function resolveExecutionOrder(steps: WorkflowStep[]): WorkflowStep[][] {
  const levels: WorkflowStep[][] = [];
  const completed = new Set<string>();
  let remaining = [...steps];

  while (remaining.length > 0) {
    const level: WorkflowStep[] = [];

    for (const step of remaining) {
      const deps = step.dependsOn ?? [];
      if (deps.every((d) => completed.has(d))) {
        level.push(step);
      }
    }

    if (level.length === 0) break;

    for (const step of level) {
      completed.add(step.id);
    }

    remaining = remaining.filter((s) => !completed.has(s.id));
    levels.push(level);
  }

  return levels;
}

export function renderWorkflowGraph(steps: WorkflowStep[]): string {
  const lines: string[] = ['Workflow Graph:', ''];
  const levels = resolveExecutionOrder(steps);

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i]!;
    const isLast = i === levels.length - 1;
    const prefix = isLast ? '└── ' : '├── ';

    if (level.length === 1) {
      const step = level[0]!;
      const cond = step.condition ? ` [if ${step.condition.field} ${step.condition.operator} ${step.condition.value ?? ''}]` : '';
      lines.push(`${prefix}${step.name} (${step.tool})${cond}`);
    } else {
      lines.push(`${prefix}Parallel group:`);
      for (let j = 0; j < level.length; j++) {
        const step = level[j]!;
        const isLastStep = j === level.length - 1;
        const nodePrefix = isLastStep ? '└── ' : '├── ';
        const cond = step.condition ? ` [if ${step.condition.field} ${step.condition.operator}]` : '';
        lines.push(`    ${nodePrefix}${step.name} (${step.tool})${cond}`);
      }
    }
  }

  return lines.join('\n');
}

export const workflowTool: ToolInstance = {
  name: 'workflow',
  description: 'Define and manage YAML-based workflow templates with step sequencing and conditional execution',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['parse', 'validate', 'graph', 'list_steps', 'evaluate_condition'],
        description: 'Action to perform',
      },
      yaml: { type: 'string', description: 'YAML workflow definition to parse' },
      stepId: { type: 'string', description: 'Step ID for specific operations' },
      context: { type: 'object', description: 'Context for condition evaluation' },
      condition: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'lt', 'contains', 'exists'] },
          value: {},
        },
        description: 'Condition to evaluate',
      },
    },
    required: ['action'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    switch (action) {
      case 'parse': {
        const yaml = String(params['yaml'] ?? '');
        if (!yaml) {
          return { success: false, output: '', error: 'No YAML provided' };
        }

        try {
          const definition = parseSimpleYaml(yaml);
          return {
            success: true,
            output: `Parsed workflow: ${definition.name}\n${definition.description}\n\nSteps (${definition.steps.length}):\n${definition.steps.map((s) => `  ${s.id}: ${s.name} -> ${s.tool}`).join('\n')}`,
            metadata: { definition },
          };
        } catch (e) {
          return { success: false, output: '', error: `Parse error: ${e}` };
        }
      }

      case 'validate': {
        const yaml = String(params['yaml'] ?? '');
        const definition = parseSimpleYaml(yaml);
        const errors: string[] = [];

        for (const step of definition.steps) {
          if (!step.id) errors.push('Step missing id');
          if (!step.tool) errors.push(`Step "${step.id}" missing tool`);
          const deps = step.dependsOn ?? [];
          for (const dep of deps) {
            if (!definition.steps.find((s) => s.id === dep)) {
              errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
            }
          }
        }

        return {
          success: errors.length === 0,
          output: errors.length === 0 ? 'Workflow is valid' : errors.join('\n'),
          metadata: { valid: errors.length === 0, stepCount: definition.steps.length },
        };
      }

      case 'graph': {
        const yaml = String(params['yaml'] ?? '');
        const definition = parseSimpleYaml(yaml);
        const graph = renderWorkflowGraph(definition.steps);
        return {
          success: true,
          output: graph,
          metadata: { steps: definition.steps.length },
        };
      }

      case 'list_steps': {
        const yaml = String(params['yaml'] ?? '');
        const definition = parseSimpleYaml(yaml);
        const levels = resolveExecutionOrder(definition.steps);
        const output = levels.map((level, i) => `Level ${i}: ${level.map((s) => s.id).join(', ')}`).join('\n');
        return { success: true, output };
      }

      case 'evaluate_condition': {
        const condition = params['condition'] as WorkflowCondition | undefined;
        const context = (params['context'] as Record<string, unknown>) ?? {};

        if (!condition) {
          return { success: false, output: '', error: 'No condition provided' };
        }

        const result = evaluateCondition(condition, context);
        return {
          success: true,
          output: `Condition ${result ? 'TRUE' : 'FALSE'}: ${condition.field} ${condition.operator} ${condition.value ?? ''}`,
          metadata: { result },
        };
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};
