import { describe, test, expect } from 'bun:test';
import { EventBus } from '../src/hooks/bus.ts';
import { HookRunner } from '../src/hooks/runner.ts';
import type { KairosConfigOutput } from '../src/config/schema.ts';

describe('EventBus', () => {
  test('emits events to handlers', async () => {
    const bus = new EventBus();
    let received = false;
    bus.on('session_start', () => { received = true; });
    await bus.emit('session_start');
    expect(received).toBe(true);
  });

  test('passes payload data', async () => {
    const bus = new EventBus();
    let data: Record<string, unknown> = {};
    bus.on('pre_tool_execution', (payload) => { data = payload.data; });
    await bus.emit('pre_tool_execution', { toolName: 'test' });
    expect(data['toolName']).toBe('test');
  });

  test('off removes handler', async () => {
    const bus = new EventBus();
    let count = 0;
    const handler = () => { count++; };
    bus.on('session_start', handler);
    await bus.emit('session_start');
    expect(count).toBe(1);
    bus.off('session_start', handler);
    await bus.emit('session_start');
    expect(count).toBe(1);
  });

  test('multiple handlers fire', async () => {
    const bus = new EventBus();
    let a = 0, b = 0;
    bus.on('session_start', () => { a++; });
    bus.on('session_start', () => { b++; });
    await bus.emit('session_start');
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  test('handler error does not break other handlers', async () => {
    const bus = new EventBus();
    let b = 0;
    bus.on('session_start', () => { throw new Error('fail'); });
    bus.on('session_start', () => { b++; });
    await bus.emit('session_start');
    expect(b).toBe(1);
  });

  test('returns success when hooks disabled', async () => {
    const config = { hooks: { enabled: false }, paths: { config: '/tmp/kairos' } } as unknown as KairosConfigOutput;
    const runner = new HookRunner(config);
    const result = await runner.runPreHooks('test', {});
    expect(result.success).toBe(true);
  });
});
