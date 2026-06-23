import type { ToolInstance, ToolContext, ToolResult } from '../types/tools.ts';

export interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'draft' | 'approved' | 'implemented' | 'verified';
  acceptanceCriteria: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DesignDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  createdAt: number;
}

export interface ProjectTask {
  id: string;
  requirementId?: string;
  title: string;
  description: string;
  type: 'requirement' | 'design' | 'implementation' | 'testing' | 'deployment';
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
  assignee?: string;
  estimate?: number;
  dependencies: string[];
  createdAt: number;
  completedAt?: number;
}

export class SDLCManager {
  private requirements: Map<string, Requirement> = new Map();
  private decisions: Map<string, DesignDecision> = new Map();
  private tasks: Map<string, ProjectTask> = new Map();

  createRequirement(title: string, description: string, priority: Requirement['priority'] = 'medium'): Requirement {
    const id = `req-${Date.now()}`;
    const req: Requirement = {
      id,
      title,
      description,
      priority,
      status: 'draft',
      acceptanceCriteria: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.requirements.set(id, req);
    return req;
  }

  updateRequirement(id: string, updates: Partial<Requirement>): Requirement | null {
    const req = this.requirements.get(id);
    if (!req) return null;
    Object.assign(req, updates, { updatedAt: Date.now() });
    return req;
  }

  getRequirement(id: string): Requirement | undefined {
    return this.requirements.get(id);
  }

  listRequirements(status?: Requirement['status']): Requirement[] {
    const reqs = Array.from(this.requirements.values());
    if (status) {
      return reqs.filter((r) => r.status === status);
    }
    return reqs;
  }

  createDecision(title: string, context: string, decision: string, consequences: string): DesignDecision {
    const id = `dec-${Date.now()}`;
    const dec: DesignDecision = {
      id,
      title,
      context,
      decision,
      consequences,
      status: 'proposed',
      createdAt: Date.now(),
    };
    this.decisions.set(id, dec);
    return dec;
  }

  updateDecision(id: string, updates: Partial<DesignDecision>): DesignDecision | null {
    const dec = this.decisions.get(id);
    if (!dec) return null;
    Object.assign(dec, updates);
    return dec;
  }

  getDecision(id: string): DesignDecision | undefined {
    return this.decisions.get(id);
  }

  listDecisions(status?: DesignDecision['status']): DesignDecision[] {
    const decs = Array.from(this.decisions.values());
    if (status) {
      return decs.filter((d) => d.status === status);
    }
    return decs;
  }

  createTask(title: string, description: string, type: ProjectTask['type'], requirementId?: string): ProjectTask {
    const id = `task-${Date.now()}`;
    const task: ProjectTask = {
      id,
      requirementId,
      title,
      description,
      type,
      status: 'todo',
      dependencies: [],
      createdAt: Date.now(),
    };
    this.tasks.set(id, task);
    return task;
  }

  updateTask(id: string, updates: Partial<ProjectTask>): ProjectTask | null {
    const task = this.tasks.get(id);
    if (!task) return null;
    Object.assign(task, updates);
    if (updates.status === 'done') {
      task.completedAt = Date.now();
    }
    return task;
  }

  getTask(id: string): ProjectTask | undefined {
    return this.tasks.get(id);
  }

  listTasks(status?: ProjectTask['status'], type?: ProjectTask['type']): ProjectTask[] {
    let tasks = Array.from(this.tasks.values());
    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }
    if (type) {
      tasks = tasks.filter((t) => t.type === type);
    }
    return tasks;
  }

  getTaskProgress(): { total: number; completed: number; percentage: number } {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter((t) => t.status === 'done').length;
    return {
      total: tasks.length,
      completed,
      percentage: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0,
    };
  }

  generateStatusReport(): string {
    const progress = this.getTaskProgress();
    const reqs = this.listRequirements();
    const decs = this.listDecisions();

    const lines: string[] = [
      '# SDLC Status Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Progress',
      `- Tasks: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
      `- Requirements: ${reqs.length}`,
      `- Decisions: ${decs.length}`,
      '',
      '## Requirements by Status',
    ];

    const reqStatuses = ['draft', 'approved', 'implemented', 'verified'] as const;
    for (const status of reqStatuses) {
      const count = reqs.filter((r) => r.status === status).length;
      lines.push(`- ${status}: ${count}`);
    }

    lines.push('');
    lines.push('## Tasks by Status');

    const taskStatuses = ['todo', 'in_progress', 'review', 'done', 'blocked'] as const;
    for (const status of taskStatuses) {
      const count = this.listTasks(status).length;
      lines.push(`- ${status}: ${count}`);
    }

    return lines.join('\n');
  }
}

export const sdlcManager = new SDLCManager();

export const sdlcInitTool: ToolInstance = {
  name: 'sdlc_init',
  description: 'Initialize SDLC agent for current project',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
  riskLevel: 'read',
  isIdempotent: true,
  async execute(_params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      output: 'SDLC agent initialized. Use /sdlc requirements to start gathering requirements.',
    };
  },
};

export const sdlcRequirementsTool: ToolInstance = {
  name: 'sdlc_requirements',
  description: 'Manage SDLC requirements',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'list', 'update', 'get'] },
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
      id: { type: 'string' },
    },
    required: ['action'],
  },
  riskLevel: 'write',
  isIdempotent: false,
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = params['action'] as string;

    switch (action) {
      case 'create': {
        const req = sdlcManager.createRequirement(
          params['title'] as string,
          params['description'] as string,
          (params['priority'] as 'high' | 'medium' | 'low') ?? 'medium',
        );
        return { success: true, output: JSON.stringify(req, null, 2) };
      }
      case 'list': {
        const reqs = sdlcManager.listRequirements();
        return { success: true, output: JSON.stringify(reqs, null, 2) };
      }
      case 'update': {
        const req = sdlcManager.updateRequirement(params['id'] as string, {
          title: params['title'] as string,
          description: params['description'] as string,
          priority: params['priority'] as 'high' | 'medium' | 'low',
        });
        return { success: true, output: JSON.stringify(req, null, 2) };
      }
      case 'get': {
        const req = sdlcManager.getRequirement(params['id'] as string);
        return { success: true, output: JSON.stringify(req, null, 2) };
      }
      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const sdlcDesignTool: ToolInstance = {
  name: 'sdlc_design',
  description: 'Manage SDLC design decisions',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'list', 'update', 'get'] },
      title: { type: 'string' },
      context: { type: 'string' },
      decision: { type: 'string' },
      consequences: { type: 'string' },
      id: { type: 'string' },
    },
    required: ['action'],
  },
  riskLevel: 'write',
  isIdempotent: false,
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = params['action'] as string;

    switch (action) {
      case 'create': {
        const dec = sdlcManager.createDecision(
          params['title'] as string,
          params['context'] as string,
          params['decision'] as string,
          params['consequences'] as string,
        );
        return { success: true, output: JSON.stringify(dec, null, 2) };
      }
      case 'list': {
        const decs = sdlcManager.listDecisions();
        return { success: true, output: JSON.stringify(decs, null, 2) };
      }
      case 'update': {
        const dec = sdlcManager.updateDecision(params['id'] as string, {
          title: params['title'] as string,
          context: params['context'] as string,
          decision: params['decision'] as string,
          consequences: params['consequences'] as string,
        });
        return { success: true, output: JSON.stringify(dec, null, 2) };
      }
      case 'get': {
        const dec = sdlcManager.getDecision(params['id'] as string);
        return { success: true, output: JSON.stringify(dec, null, 2) };
      }
      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const sdlcTaskTool: ToolInstance = {
  name: 'sdlc_task',
  description: 'Manage SDLC tasks',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'list', 'update', 'get', 'progress'] },
      title: { type: 'string' },
      description: { type: 'string' },
      type: { type: 'string', enum: ['requirement', 'design', 'implementation', 'testing', 'deployment'] },
      status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done', 'blocked'] },
      id: { type: 'string' },
      requirementId: { type: 'string' },
      estimate: { type: 'number' },
    },
    required: ['action'],
  },
  riskLevel: 'write',
  isIdempotent: false,
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = params['action'] as string;

    switch (action) {
      case 'create': {
        const task = sdlcManager.createTask(
          params['title'] as string,
          params['description'] as string,
          (params['type'] as any) ?? 'implementation',
          params['requirementId'] as string,
        );
        return { success: true, output: JSON.stringify(task, null, 2) };
      }
      case 'list': {
        const tasks = sdlcManager.listTasks(
          params['status'] as any,
          params['type'] as any,
        );
        return { success: true, output: JSON.stringify(tasks, null, 2) };
      }
      case 'update': {
        const task = sdlcManager.updateTask(params['id'] as string, {
          title: params['title'] as string,
          description: params['description'] as string,
          status: params['status'] as any,
          estimate: params['estimate'] as number,
        });
        return { success: true, output: JSON.stringify(task, null, 2) };
      }
      case 'get': {
        const task = sdlcManager.getTask(params['id'] as string);
        return { success: true, output: JSON.stringify(task, null, 2) };
      }
      case 'progress': {
        const progress = sdlcManager.getTaskProgress();
        return { success: true, output: JSON.stringify(progress, null, 2) };
      }
      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};

export const sdlcReportTool: ToolInstance = {
  name: 'sdlc_report',
  description: 'Generate SDLC status report',
  parameters: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['markdown', 'json'] },
    },
    required: [],
  },
  riskLevel: 'read',
  isIdempotent: true,
  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const format = (params['format'] as string) ?? 'markdown';

    if (format === 'json') {
      const progress = sdlcManager.getTaskProgress();
      const reqs = sdlcManager.listRequirements();
      const decs = sdlcManager.listDecisions();
      return {
        success: true,
        output: JSON.stringify({ progress, requirements: reqs, decisions: decs }, null, 2),
      };
    }

    const report = sdlcManager.generateStatusReport();
    return { success: true, output: report };
  },
};
