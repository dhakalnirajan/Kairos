export interface ProgressStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: number;
  endTime?: number;
}

export class ProgressBar {
  private steps: ProgressStep[] = [];
  private startTime: number = Date.now();

  addStep(id: string, name: string): void {
    this.steps.push({
      id,
      name,
      status: 'pending',
      progress: 0,
    });
  }

  startStep(id: string): void {
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      step.status = 'running';
      step.startTime = Date.now();
    }
  }

  updateProgress(id: string, progress: number): void {
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      step.progress = Math.min(100, Math.max(0, progress));
    }
  }

  completeStep(id: string): void {
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      step.status = 'completed';
      step.progress = 100;
      step.endTime = Date.now();
    }
  }

  failStep(id: string): void {
    const step = this.steps.find((s) => s.id === id);
    if (step) {
      step.status = 'failed';
      step.endTime = Date.now();
    }
  }

  getProgress(): number {
    if (this.steps.length === 0) return 0;
    return this.steps.reduce((sum, s) => sum + s.progress, 0) / this.steps.length;
  }

  getETA(): number | null {
    const elapsed = Date.now() - this.startTime;
    const progress = this.getProgress();
    if (progress === 0) return null;
    return (elapsed / progress) * (100 - progress);
  }

  toAscii(): string {
    const lines: string[] = ['Progress:', ''];
    const total = this.getProgress();
    const filled = Math.round(total / 5);
    const empty = 20 - filled;
    lines.push(`[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${total.toFixed(1)}%`);

    const eta = this.getETA();
    if (eta !== null) {
      lines.push(`ETA: ${Math.round(eta / 1000)}s`);
    }

    lines.push('');
    for (const step of this.steps) {
      const icon = step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : step.status === 'running' ? '⟳' : '○';
      lines.push(`${icon} ${step.name} (${step.progress}%)`);
    }

    return lines.join('\n');
  }

  clear(): void {
    this.steps = [];
    this.startTime = Date.now();
  }
}
