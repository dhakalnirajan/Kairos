export interface ToolManifest {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskLevel: 'read' | 'write' | 'execute' | 'network';
  isIdempotent: boolean;
}

export interface ToolContext {
  workspaceRoot: string;
  sessionId: string;
  config?: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: ToolResult;
}

export interface ToolInstance extends ToolManifest {
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export interface SafetyVerdict {
  allowed: boolean;
  reason?: string;
  layer: string;
}

export type AgentMode = 'NORMAL' | 'PLAN' | 'ULTRAPLAN' | 'AUTO' | 'YOLO' | 'SWARM' | 'DAEMON' | 'DREAM' | 'UNDERCOVER' | 'HEADLESS' | 'VOICE';

export interface AgentTurn {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface Session {
  id: string;
  title: string;
  turns: AgentTurn[];
  createdAt: number;
  updatedAt: number;
  model: string;
}
