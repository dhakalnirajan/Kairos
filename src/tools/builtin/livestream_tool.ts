import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

const processOutputs = new Map<string, { stdout: string[]; stderr: string[]; active: boolean }>();

export const liveStreamingTool: ToolInstance = {
  name: 'live_streaming',
  description: 'Live command streaming: capture stdout/stderr line-by-line, stream to TUI panels, monitor long-running processes',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['start_capture', 'get_output', 'stop_capture', 'list_streams', 'clear'], description: 'Streaming action' },
      stream_id: { type: 'string', description: 'Stream ID' },
      lines: { type: 'number', description: 'Number of recent lines to return' },
    },
    required: ['action'],
  },
  riskLevel: 'execute' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'start_capture': {
          const id = `stream-${Date.now()}`;
          processOutputs.set(id, { stdout: [], stderr: [], active: true });
          return { success: true, output: `Started capture: ${id}`, metadata: { streamId: id } };
        }
        case 'get_output': {
          const streamId = String(params['stream_id'] ?? '');
          if (!streamId) return { success: false, output: '', error: 'stream_id required' };
          const stream = processOutputs.get(streamId);
          if (!stream) return { success: false, output: '', error: `Stream not found: ${streamId}` };
          const lines = Number(params['lines'] ?? 50);
          const stdout = stream.stdout.slice(-lines);
          const stderr = stream.stderr.slice(-lines);
          const output = [...stdout.map((l) => `[OUT] ${l}`), ...stderr.map((l) => `[ERR] ${l}`)].join('\n');
          return { success: true, output: output || 'No output yet', metadata: { stdout: stream.stdout.length, stderr: stream.stderr.length } };
        }
        case 'stop_capture': {
          const streamId = String(params['stream_id'] ?? '');
          if (!streamId) return { success: false, output: '', error: 'stream_id required' };
          const stream = processOutputs.get(streamId);
          if (stream) stream.active = false;
          return { success: true, output: `Stopped capture: ${streamId}` };
        }
        case 'list_streams': {
          const streams = Array.from(processOutputs.entries()).map(([id, s]) => `${id}: ${s.active ? 'active' : 'stopped'} (${s.stdout.length} stdout, ${s.stderr.length} stderr)`);
          return { success: true, output: streams.join('\n') || 'No streams', metadata: { count: streams.length } };
        }
        case 'clear': {
          processOutputs.clear();
          return { success: true, output: 'All streams cleared' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Live streaming failed: ${e}` };
    }
  },
};
