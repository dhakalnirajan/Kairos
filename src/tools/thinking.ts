export interface ThoughtStep {
  id: string;
  type: 'thought' | 'action' | 'observation' | 'reflection';
  content: string;
  timestamp: number;
  duration?: number;
}

export interface ThoughtChain {
  id: string;
  steps: ThoughtStep[];
  startTime: number;
  endTime?: number;
}

export class ThinkingTransparency {
  private chains: Map<string, ThoughtChain> = new Map();
  private currentChain: ThoughtChain | null = null;

  startChain(chainId?: string): ThoughtChain {
    const id = chainId ?? `chain-${Date.now()}`;
    const chain: ThoughtChain = {
      id,
      steps: [],
      startTime: Date.now(),
    };
    this.chains.set(id, chain);
    this.currentChain = chain;
    return chain;
  }

  addStep(type: ThoughtStep['type'], content: string): ThoughtStep | null {
    if (!this.currentChain) return null;

    const step: ThoughtStep = {
      id: `step-${Date.now()}`,
      type,
      content,
      timestamp: Date.now(),
    };

    this.currentChain.steps.push(step);
    return step;
  }

  endChain(): ThoughtChain | null {
    if (!this.currentChain) return null;
    this.currentChain.endTime = Date.now();
    const chain = this.currentChain;
    this.currentChain = null;
    return chain;
  }

  getCurrentChain(): ThoughtChain | null {
    return this.currentChain;
  }

  getChain(id: string): ThoughtChain | undefined {
    return this.chains.get(id);
  }

  getAllChains(): ThoughtChain[] {
    return Array.from(this.chains.values());
  }

  formatChain(chain: ThoughtChain): string {
    const lines: string[] = [
      `## Thought Chain: ${chain.id}`,
      '',
      `Started: ${new Date(chain.startTime).toISOString()}`,
      chain.endTime ? `Ended: ${new Date(chain.endTime).toISOString()}` : '',
      '',
      '### Steps',
      '',
    ];

    for (const step of chain.steps) {
      const icon = this.getStepIcon(step.type);
      lines.push(`${icon} **${step.type}**: ${step.content}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private getStepIcon(type: ThoughtStep['type']): string {
    switch (type) {
      case 'thought': return '💭';
      case 'action': return '⚡';
      case 'observation': return '👁️';
      case 'reflection': return '🔍';
    }
  }

  toAscii(chain: ThoughtChain): string {
    const lines: string[] = ['Thought Chain:', ''];

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i]!;
      const prefix = i === chain.steps.length - 1 ? '└── ' : '├── ';
      lines.push(`${prefix}${step.type}: ${step.content.slice(0, 50)}${step.content.length > 50 ? '...' : ''}`);
    }

    return lines.join('\n');
  }

  clear(): void {
    this.chains.clear();
    this.currentChain = null;
  }
}

export const thinkingTransparency = new ThinkingTransparency();
