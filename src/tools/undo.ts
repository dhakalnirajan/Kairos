export interface UndoEntry {
  id: string;
  timestamp: number;
  type: 'turn' | 'tool' | 'edit';
  description: string;
  data: Record<string, unknown>;
}

export class UndoManager {
  private entries: UndoEntry[] = [];
  private maxSize = 100;

  addEntry(type: UndoEntry['type'], description: string, data: Record<string, unknown> = {}): string {
    const id = `undo-${Date.now()}`;
    this.entries.push({
      id,
      timestamp: Date.now(),
      type,
      description,
      data,
    });

    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }

    return id;
  }

  undo(lastN: number = 1): UndoEntry | null {
    if (this.entries.length < lastN) return null;
    return this.entries.splice(-lastN)[0] ?? null;
  }

  undoByType(type: UndoEntry['type']): UndoEntry | null {
    const idx = this.entries.findLastIndex((e) => e.type === type);
    if (idx >= 0) {
      return this.entries.splice(idx, 1)[0] ?? null;
    }
    return null;
  }

  getEntries(limit?: number): UndoEntry[] {
    if (limit) {
      return this.entries.slice(-limit);
    }
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }

  getSize(): number {
    return this.entries.length;
  }
}

export const undoManager = new UndoManager();
