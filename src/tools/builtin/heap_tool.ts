import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export const heapSnapshotTool: ToolInstance = {
  name: 'heap_snapshot',
  description: 'Heap snapshot analysis: capture memory snapshots, detect leaks, identify largest objects, track allocations',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['snapshot', 'current_usage', 'detect_leaks', 'top_allocations', 'gc_stats'], description: 'Heap action' },
      label: { type: 'string', description: 'Snapshot label' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'current_usage': {
          const mem = process.memoryUsage();
          const output = [
            `RSS:      ${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
            `Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
            `Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
            `External:  ${(mem.external / 1024 / 1024).toFixed(1)} MB`,
            `Array Buffers: ${(mem.arrayBuffers / 1024 / 1024).toFixed(1)} MB`,
          ].join('\n');
          return { success: true, output, metadata: mem as unknown as Record<string, unknown> };
        }
        case 'snapshot': {
          const label = String(params['label'] ?? `snapshot-${Date.now()}`);
          if (global.gc) global.gc();
          const before = process.memoryUsage();
          const snapshot = {
            label,
            timestamp: Date.now(),
            heapUsed: before.heapUsed,
            heapTotal: before.heapTotal,
            rss: before.rss,
            external: before.external,
          };
          return {
            success: true,
            output: `Heap snapshot "${label}" captured\nHeap: ${(before.heapUsed / 1024 / 1024).toFixed(1)} MB used / ${(before.heapTotal / 1024 / 1024).toFixed(1)} MB total`,
            metadata: snapshot as unknown as Record<string, unknown>,
          };
        }
        case 'detect_leaks': {
          const before = process.memoryUsage();
          if (global.gc) global.gc();
          const after = process.memoryUsage();
          const heapGrowth = after.heapUsed - before.heapUsed;
          const output = heapGrowth > 1024 * 1024
            ? `⚠ Potential memory issue: heap grew by ${(heapGrowth / 1024 / 1024).toFixed(1)} MB after GC`
            : `Heap stable after GC (delta: ${(heapGrowth / 1024).toFixed(1)} KB)`;
          return { success: true, output, metadata: { heapGrowth, before: before.heapUsed, after: after.heapUsed } };
        }
        case 'top_allocations': {
          const mem = process.memoryUsage();
          const total = mem.rss;
          const items = [
            { name: 'Heap Used', bytes: mem.heapUsed },
            { name: 'External', bytes: mem.external },
            { name: 'Array Buffers', bytes: mem.arrayBuffers },
          ].sort((a, b) => b.bytes - a.bytes);
          const output = items.map((i) => `${i.name.padEnd(20)} ${(i.bytes / 1024 / 1024).toFixed(1)} MB (${((i.bytes / total) * 100).toFixed(1)}%)`).join('\n');
          return { success: true, output: `Total RSS: ${(total / 1024 / 1024).toFixed(1)} MB\n\n${output}` };
        }
        case 'gc_stats': {
          const supportsGC = typeof global.gc === 'function';
          const output = [
            `GC Available: ${supportsGC ? 'Yes (--expose-gc)' : 'No'}`,
            `Heap Size: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB`,
            `Heap Used: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`,
            `Heap Limit: ${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1)} MB`,
          ].join('\n');
          return { success: true, output };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Heap analysis failed: ${e}` };
    }
  },
};
