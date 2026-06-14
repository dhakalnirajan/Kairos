import { describe, test, expect } from 'bun:test';
import { getModeConfig, isValidMode, getAllModes } from '../src/agent/modes.ts';
import type { AgentMode } from '../src/types/tools.ts';

describe('Agent Modes', () => {
  test('getModeConfig returns config for valid mode', () => {
    const config = getModeConfig('NORMAL');
    expect(config.maxIterations).toBe(20);
    expect(config.hitlRequired).toBe(true);
  });

  test('getModeConfig returns NORMAL for unknown mode', () => {
    const config = getModeConfig('UNKNOWN' as AgentMode);
    expect(config.maxIterations).toBe(20);
  });

  test('PLAN mode disables write/execute', () => {
    const config = getModeConfig('PLAN');
    expect(config.allowWrite).toBe(false);
    expect(config.allowExecute).toBe(false);
  });

  test('YOLO mode disables HITL', () => {
    const config = getModeConfig('YOLO');
    expect(config.hitlRequired).toBe(false);
    expect(config.maxIterations).toBe(50);
  });

  test('ULTRAPLAN has large thinking budget', () => {
    const config = getModeConfig('ULTRAPLAN');
    expect(config.thinkingBudget).toBe(32768);
  });

  test('isValidMode validates correctly', () => {
    expect(isValidMode('NORMAL')).toBe(true);
    expect(isValidMode('invalid')).toBe(false);
  });

  test('getAllModes returns all modes', () => {
    const modes = getAllModes();
    expect(modes).toContain('NORMAL');
    expect(modes).toContain('HEADLESS');
    expect(modes.length).toBe(11);
  });
});
