import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { ProgressBar } from '../progress.ts';

const activeProgress = new Map<string, ProgressBar>();

export const progressTool: ToolInstance = {
  name: 'progress',
  description: 'Multi-step progress tracking: add steps, update progress, get ASCII visualization',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'add_step', 'start', 'update', 'complete', 'fail', 'get_progress', 'to_ascii', 'clear'], description: 'Progress action' },
      progress_id: { type: 'string', description: 'Progress tracker ID' },
      step_id: { type: 'string', description: 'Step ID' },
      step_name: { type: 'string', description: 'Step name' },
      progress: { type: 'number', description: 'Progress percentage (0-100)' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');
    const progressId = String(params['progress_id'] ?? 'default');

    try {
      switch (action) {
        case 'create': {
          const bar = new ProgressBar();
          activeProgress.set(progressId, bar);
          return { success: true, output: `Created progress tracker: ${progressId}` };
        }
        case 'add_step': {
          const bar = activeProgress.get(progressId) ?? new ProgressBar();
          activeProgress.set(progressId, bar);
          const stepId = String(params['step_id'] ?? `step-${Date.now()}`);
          const stepName = String(params['step_name'] ?? stepId);
          bar.addStep(stepId, stepName);
          return { success: true, output: `Added step: ${stepName}` };
        }
        case 'start': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          const stepId = String(params['step_id'] ?? '');
          if (!stepId) return { success: false, output: '', error: 'step_id required' };
          bar.startStep(stepId);
          return { success: true, output: `Started step: ${stepId}` };
        }
        case 'update': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          const stepId = String(params['step_id'] ?? '');
          const progress = Number(params['progress'] ?? 0);
          bar.updateProgress(stepId, progress);
          return { success: true, output: `Updated ${stepId}: ${progress}%` };
        }
        case 'complete': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          const stepId = String(params['step_id'] ?? '');
          bar.completeStep(stepId);
          return { success: true, output: `Completed step: ${stepId}` };
        }
        case 'fail': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          const stepId = String(params['step_id'] ?? '');
          bar.failStep(stepId);
          return { success: true, output: `Failed step: ${stepId}` };
        }
        case 'get_progress': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          const total = bar.getProgress();
          return { success: true, output: `Progress: ${total}% complete` };
        }
        case 'to_ascii': {
          const bar = activeProgress.get(progressId);
          if (!bar) return { success: false, output: '', error: `Progress tracker not found: ${progressId}` };
          return { success: true, output: bar.toAscii() };
        }
        case 'clear': {
          activeProgress.delete(progressId);
          return { success: true, output: `Cleared progress tracker: ${progressId}` };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Progress tool failed: ${e}` };
    }
  },
};
