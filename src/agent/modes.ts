import type { AgentMode } from '../types/tools.ts';

const MODE_CONFIGS: Record<AgentMode, {
  thinkingBudget: number;
  maxIterations: number;
  allowWrite: boolean;
  allowExecute: boolean;
  allowNetwork: boolean;
  hitlRequired: boolean;
  description: string;
}> = {
  NORMAL: { thinkingBudget: 4096, maxIterations: 20, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: true, description: 'Default mode with HITL for risky tools' },
  PLAN: { thinkingBudget: 8192, maxIterations: 10, allowWrite: false, allowExecute: false, allowNetwork: false, hitlRequired: false, description: 'Read-only planning mode' },
  ULTRAPLAN: { thinkingBudget: 32768, maxIterations: 10, allowWrite: false, allowExecute: false, allowNetwork: false, hitlRequired: false, description: 'Deep planning with large thinking budget' },
  AUTO: { thinkingBudget: 4096, maxIterations: 30, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: false, description: 'Auto-approve safe tools' },
  YOLO: { thinkingBudget: 4096, maxIterations: 50, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: false, description: 'Bypass all HITL gates' },
  SWARM: { thinkingBudget: 4096, maxIterations: 20, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: true, description: '1 coordinator + 2 workers' },
  DAEMON: { thinkingBudget: 4096, maxIterations: 100, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: false, description: 'Background process mode' },
  DREAM: { thinkingBudget: 16384, maxIterations: 5, allowWrite: false, allowExecute: false, allowNetwork: false, hitlRequired: false, description: 'Memory consolidation mode' },
  UNDERCOVER: { thinkingBudget: 4096, maxIterations: 20, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: true, description: 'Strip AI fingerprints from commits' },
  HEADLESS: { thinkingBudget: 4096, maxIterations: 20, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: false, description: 'No TUI, stdout/stderr only' },
  VOICE: { thinkingBudget: 4096, maxIterations: 20, allowWrite: true, allowExecute: true, allowNetwork: true, hitlRequired: false, description: 'Pipe I/O to STT/TTS binaries' },
};

export function getModeConfig(mode: AgentMode) {
  return MODE_CONFIGS[mode] ?? MODE_CONFIGS['NORMAL']!;
}

export function isValidMode(mode: string): mode is AgentMode {
  return mode in MODE_CONFIGS;
}

export function getAllModes(): AgentMode[] {
  return Object.keys(MODE_CONFIGS) as AgentMode[];
}
