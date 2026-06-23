import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { timeTracker } from '../session/tracking.ts';

export const trackingTool: ToolInstance = {
  name: 'time_tracking',
  description: 'Time tracking: start/stop timers, view entries, get summaries',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start', 'stop', 'entries', 'summary', 'export_csv', 'clear'], description: 'Tracking action' },
      timer_id: { type: 'string', description: 'Timer ID to stop' },
      action_name: { type: 'string', description: 'Action name for the timer entry' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'start': {
          const actionName = String(params['action_name'] ?? 'unnamed');
          const id = timeTracker.startTimer(actionName);
          return { success: true, output: `Timer started: ${id}`, metadata: { timerId: id } };
        }
        case 'stop': {
          const timerId = String(params['timer_id'] ?? '');
          if (!timerId) return { success: false, output: '', error: 'timer_id required' };
          const actionName = String(params['action_name'] ?? 'completed');
          const entry = timeTracker.stopTimer(timerId, actionName);
          return entry
            ? { success: true, output: `Stopped: ${entry.action} (${entry.duration}ms)`, metadata: entry as unknown as Record<string, unknown> }
            : { success: false, output: '', error: `Timer not found: ${timerId}` };
        }
        case 'entries': {
          const entries = timeTracker.getEntries();
          const output = entries.map((e) => `${e.id}: ${e.action} (${e.duration}ms) @ ${new Date(e.timestamp).toISOString()}`).join('\n');
          return { success: true, output: output || 'No entries', metadata: { count: entries.length } };
        }
        case 'summary': {
          const summary = timeTracker.getSummary();
          const output = Object.entries(summary).map(([action, total]) => `${action}: ${total}ms`).join('\n');
          return { success: true, output: output || 'No summary data' };
        }
        case 'export_csv': {
          const csv = timeTracker.exportCSV();
          return { success: true, output: csv || 'No data to export' };
        }
        case 'clear': {
          timeTracker.clear();
          return { success: true, output: 'Tracking data cleared' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Tracking failed: ${e}` };
    }
  },
};
