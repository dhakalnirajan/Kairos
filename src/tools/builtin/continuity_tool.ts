import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const sessionContinuityTool: ToolInstance = {
  name: 'session_continuity',
  description: 'Cross-session continuation: persistent task queue, --continue flag support, task management',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add_task', 'list_tasks', 'complete_task', 'get_next', 'clear', 'export_tasks'], description: 'Task queue action' },
      task: { type: 'string', description: 'Task description' },
      priority: { type: 'number', description: 'Task priority (1=highest)' },
      task_id: { type: 'string', description: 'Task ID' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'done', 'blocked'], description: 'Task status' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const queuePath = join(ctx.workspaceRoot, '.kairos', 'task-queue.json');

    interface Task { id: string; description: string; priority: number; status: string; created: number; completed?: number }
    function loadQueue(): Task[] { try { return JSON.parse(readFileSync(queuePath, 'utf-8')); } catch { return []; } }
    function saveQueue(queue: Task[]): void {
      const dir = join(ctx.workspaceRoot, '.kairos');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(queuePath, JSON.stringify(queue, null, 2));
    }

    try {
      const queue = loadQueue();
      switch (action) {
        case 'add_task': {
          const desc = String(params['task'] ?? '');
          if (!desc) return { success: false, output: '', error: 'task description required' };
          const priority = Number(params['priority'] ?? queue.length + 1);
          const task: Task = { id: `task-${Date.now()}`, description: desc, priority, status: 'pending', created: Date.now() };
          queue.push(task);
          queue.sort((a, b) => a.priority - b.priority);
          saveQueue(queue);
          return { success: true, output: `Added task: ${task.id} — ${desc} (priority: ${priority})` };
        }
        case 'list_tasks': {
          const output = queue.map((t) => `[${t.status}] ${t.id}: ${t.description} (P${t.priority})`).join('\n');
          return { success: true, output: output || 'No tasks', metadata: { count: queue.length } };
        }
        case 'complete_task': {
          const taskId = String(params['task_id'] ?? '');
          if (!taskId) return { success: false, output: '', error: 'task_id required' };
          const task = queue.find((t) => t.id === taskId);
          if (!task) return { success: false, output: '', error: `Task not found: ${taskId}` };
          task.status = 'done';
          task.completed = Date.now();
          saveQueue(queue);
          return { success: true, output: `Completed: ${task.description}` };
        }
        case 'get_next': {
          const next = queue.find((t) => t.status === 'pending');
          return next
            ? { success: true, output: `Next task: ${next.id} — ${next.description} (P${next.priority})`, metadata: next as unknown as Record<string, unknown> }
            : { success: true, output: 'No pending tasks' };
        }
        case 'clear': {
          saveQueue([]);
          return { success: true, output: 'Task queue cleared' };
        }
        case 'export_tasks': {
          return { success: true, output: JSON.stringify(queue, null, 2) };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Session continuity failed: ${e}` };
    }
  },
};
