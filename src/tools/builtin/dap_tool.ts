import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { dapBridge } from '../dap.ts';

export const dapTool: ToolInstance = {
  name: 'debug_adapter',
  description: 'Debug Adapter Protocol: connect to debuggers, manage breakpoints, inspect variables, control execution',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['connect', 'disconnect', 'set_breakpoint', 'remove_breakpoint', 'list_breakpoints', 'continue', 'step_over', 'step_into', 'step_out', 'pause', 'stack_frames', 'variables', 'evaluate', 'is_debugging'],
        description: 'Debug action',
      },
      server_name: { type: 'string', description: 'Server name' },
      command: { type: 'string', description: 'Debug server command' },
      file: { type: 'string', description: 'File path' },
      line: { type: 'number', description: 'Line number' },
      condition: { type: 'string', description: 'Breakpoint condition' },
      expression: { type: 'string', description: 'Expression to evaluate' },
    },
    required: ['action'],
  },
  riskLevel: 'execute' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'connect': {
          const name = String(params['server_name'] ?? 'default');
          const command = String(params['command'] ?? 'node');
          const connected = await dapBridge.connectServer({ name, command, args: ['--inspect'] });
          return { success: connected, output: connected ? `Connected to ${name}` : 'Connection failed' };
        }
        case 'disconnect': {
          dapBridge.disconnect();
          return { success: true, output: 'Disconnected' };
        }
        case 'set_breakpoint': {
          const file = String(params['file'] ?? '');
          const line = Number(params['line'] ?? 0);
          if (!file || !line) return { success: false, output: '', error: 'file and line required' };
          const bp = await dapBridge.setBreakpoint(file, line, params.condition ? String(params.condition) : undefined);
          return { success: true, output: `Breakpoint set at ${file}:${line}`, metadata: bp as unknown as Record<string, unknown> };
        }
        case 'remove_breakpoint': {
          const file = String(params['file'] ?? '');
          const line = Number(params['line'] ?? 0);
          if (!file || !line) return { success: false, output: '', error: 'file and line required' };
          const removed = await dapBridge.removeBreakpoint(file, line);
          return { success: removed, output: removed ? `Removed breakpoint at ${file}:${line}` : 'Not found' };
        }
        case 'list_breakpoints': {
          const bps = dapBridge.getBreakpoints();
          const output = bps.map((bp) => `${bp.file}:${bp.line} ${bp.condition ? `[${bp.condition}]` : ''} ${bp.verified ? 'verified' : 'pending'}`).join('\n');
          return { success: true, output: output || 'No breakpoints', metadata: { count: bps.length } };
        }
        case 'continue': { await dapBridge.continue(); return { success: true, output: 'Continued' }; }
        case 'step_over': { await dapBridge.stepOver(); return { success: true, output: 'Step over' }; }
        case 'step_into': { await dapBridge.stepInto(); return { success: true, output: 'Step into' }; }
        case 'step_out': { await dapBridge.stepOut(); return { success: true, output: 'Step out' }; }
        case 'pause': { await dapBridge.pause(); return { success: true, output: 'Paused' }; }
        case 'stack_frames': {
          const frames = await dapBridge.getStackFrames();
          const output = frames.map((f) => `#${f.id} ${f.name} at ${f.file}:${f.line}:${f.column}`).join('\n');
          return { success: true, output: output || 'No stack frames', metadata: { count: frames.length } };
        }
        case 'variables': {
          const vars = await dapBridge.getVariables();
          const output = vars.map((v) => `${v.name}: ${v.value} (${v.type})`).join('\n');
          return { success: true, output: output || 'No variables', metadata: { count: vars.length } };
        }
        case 'evaluate': {
          const expr = String(params['expression'] ?? '');
          if (!expr) return { success: false, output: '', error: 'expression required' };
          const result = await dapBridge.evaluate(expr);
          return { success: true, output: result };
        }
        case 'is_debugging': {
          return { success: true, output: dapBridge.isDebugging() ? 'Debugging' : 'Not debugging' };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Debug failed: ${e}` };
    }
  },
};
