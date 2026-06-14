export interface DAPServer {
  name: string;
  command: string;
  args: string[];
  port?: number;
}

export interface DAPBreakpoint {
  file: string;
  line: number;
  condition?: string;
  verified: boolean;
}

export interface DAPStackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface DAPVariable {
  name: string;
  value: string;
  type: string;
}

export class DAPBridge {
  private servers: Map<string, DAPServer> = new Map();
  private breakpoints: DAPBreakpoint[] = [];
  private stackFrames: DAPStackFrame[] = [];
  private variables: DAPVariable[] = [];
  private isRunning = false;

  async connectServer(config: DAPServer): Promise<boolean> {
    this.servers.set(config.name, config);
    return true;
  }

  async setBreakpoint(file: string, line: number, condition?: string): Promise<DAPBreakpoint> {
    const bp: DAPBreakpoint = { file, line, condition, verified: true };
    this.breakpoints.push(bp);
    return bp;
  }

  async removeBreakpoint(file: string, line: number): Promise<boolean> {
    const idx = this.breakpoints.findIndex((bp) => bp.file === file && bp.line === line);
    if (idx >= 0) {
      this.breakpoints.splice(idx, 1);
      return true;
    }
    return false;
  }

  async continue(): Promise<void> {
    this.isRunning = true;
  }

  async stepOver(): Promise<void> {
    if (this.stackFrames.length > 0) {
      this.stackFrames[0]!.line++;
    }
  }

  async stepInto(): Promise<void> {
    if (this.stackFrames.length > 0) {
      this.stackFrames[0]!.line++;
    }
  }

  async stepOut(): Promise<void> {
    if (this.stackFrames.length > 1) {
      this.stackFrames.shift();
    }
  }

  async pause(): Promise<void> {
    this.isRunning = false;
  }

  async getStackFrames(): Promise<DAPStackFrame[]> {
    return [...this.stackFrames];
  }

  async getVariables(): Promise<DAPVariable[]> {
    return [...this.variables];
  }

  async evaluate(expression: string): Promise<string> {
    return `Value of: ${expression}`;
  }

  isDebugging(): boolean {
    return this.isRunning;
  }

  getBreakpoints(): DAPBreakpoint[] {
    return [...this.breakpoints];
  }

  disconnect(): void {
    this.servers.clear();
    this.breakpoints = [];
    this.stackFrames = [];
    this.variables = [];
    this.isRunning = false;
  }
}

export const dapBridge = new DAPBridge();
