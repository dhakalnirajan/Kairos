import { readFileSync, writeFileSync } from 'fs';

export interface ReviewComment {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'suggestion' | 'nit';
  category: string;
  message: string;
  suggestion?: string;
}

export interface PRComment {
  id: string;
  file?: string;
  line?: number;
  body: string;
  resolved: boolean;
  author: string;
  timestamp: number;
}

export interface ConflictRegion {
  file: string;
  startLine: number;
  endLine: number;
  ours: string;
  theirs: string;
  base?: string;
}

export interface MergeResolution {
  conflict: ConflictRegion;
  resolution: string;
  strategy: 'ours' | 'theirs' | 'manual' | 'auto';
}

export class CollaborativeEngine {
  simulateCodeReview(file: string, content: string): ReviewComment[] {
    const comments: ReviewComment[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      const anyType = line.match(/:\s*any\b/);
      if (anyType) {
        comments.push({
          file,
          line: i + 1,
          severity: 'warning',
          category: 'type-safety',
          message: 'Usage of `any` type detected',
          suggestion: 'Consider using a more specific type',
        });
      }

      const todoComment = line.match(/\/\/\s*(?:TODO|FIXME|HACK|XXX)/i);
      if (todoComment) {
        comments.push({
          file,
          line: i + 1,
          severity: 'suggestion',
          category: 'maintenance',
          message: 'Unresolved TODO/FIXME comment',
          suggestion: 'Create a tracking issue or resolve before merge',
        });
      }

      const longLine = line.length > 120;
      if (longLine) {
        comments.push({
          file,
          line: i + 1,
          severity: 'nit',
          category: 'style',
          message: `Line exceeds 120 characters (${line.length})`,
          suggestion: 'Consider breaking into multiple lines',
        });
      }

      const consoleLog = line.match(/console\.(log|error|warn)\s*\(/);
      if (consoleLog) {
        comments.push({
          file,
          line: i + 1,
          severity: 'warning',
          category: 'cleanup',
          message: `Console ${consoleLog[1]} statement found`,
          suggestion: 'Remove before merging to production',
        });
      }

      const magicNumber = line.match(/(?<!\w)\d{3,}(?!\w)/);
      if (magicNumber && !line.includes('//') && !line.includes('*')) {
        comments.push({
          file,
          line: i + 1,
          severity: 'suggestion',
          category: 'readability',
          message: 'Magic number detected',
          suggestion: 'Consider extracting to a named constant',
        });
      }
    }

    return comments;
  }

  generatePRSummary(comments: ReviewComment[]): string {
    const byCategory = new Map<string, ReviewComment[]>();
    for (const comment of comments) {
      const existing = byCategory.get(comment.category) ?? [];
      existing.push(comment);
      byCategory.set(comment.category, existing);
    }

    const lines = [
      '## Code Review Summary',
      '',
      `**Total comments:** ${comments.length}`,
      '',
    ];

    const severityOrder = ['error', 'warning', 'suggestion', 'nit'] as const;
    for (const severity of severityOrder) {
      const count = comments.filter((c) => c.severity === severity).length;
      if (count > 0) {
        lines.push(`- **${severity.charAt(0).toUpperCase() + severity.slice(1)}:** ${count}`);
      }
    }

    lines.push('');

    for (const [category, cats] of byCategory) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      for (const comment of cats) {
        lines.push(`- Line ${comment.line}: ${comment.message}`);
        if (comment.suggestion) {
          lines.push(`  > Suggestion: ${comment.suggestion}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  generateInlineComments(comments: ReviewComment[]): PRComment[] {
    return comments.map((c, idx) => ({
      id: `review-${idx}`,
      file: c.file,
      line: c.line,
      body: `[${c.severity.toUpperCase()}] ${c.message}${c.suggestion ? `\n\nSuggestion: ${c.suggestion}` : ''}`,
      resolved: false,
      author: 'kairos-review',
      timestamp: Date.now(),
    }));
  }

  parseConflict(content: string, marker = '<<<<<<<'): ConflictRegion[] {
    const conflicts: ConflictRegion[] = [];
    const lines = content.split('\n');

    let i = 0;
    while (i < lines.length) {
      if (lines[i]?.startsWith(marker)) {
        const startLine = i + 1;
        const ours: string[] = [];
        const theirs: string[] = [];

        i++;
        while (i < lines.length && !lines[i]?.startsWith('=======') && !lines[i]?.startsWith('>>>>>>>')) {
          ours.push(lines[i]!);
          i++;
        }

        if (lines[i]?.startsWith('=======')) {
          i++;
          while (i < lines.length && !lines[i]?.startsWith('>>>>>>>')) {
            theirs.push(lines[i]!);
            i++;
          }
        }

        const endLine = i + 1;

        conflicts.push({
          file: '',
          startLine,
          endLine,
          ours: ours.join('\n'),
          theirs: theirs.join('\n'),
        });
      }
      i++;
    }

    return conflicts;
  }

  resolveConflict(
    conflict: ConflictRegion,
    strategy: 'ours' | 'theirs' | 'auto',
    manualResolution?: string,
  ): MergeResolution {
    let resolution: string;

    switch (strategy) {
      case 'ours':
        resolution = conflict.ours;
        break;
      case 'theirs':
        resolution = conflict.theirs;
        break;
      case 'auto':
        resolution = this.autoMerge(conflict);
        break;
      default:
        resolution = manualResolution ?? conflict.ours;
    }

    return {
      conflict,
      resolution,
      strategy: manualResolution ? 'manual' : strategy,
    };
  }

  private autoMerge(conflict: ConflictRegion): string {
    const oursLines = conflict.ours.split('\n').filter((l) => l.trim());
    const theirsLines = conflict.theirs.split('\n').filter((l) => l.trim());

    const merged = new Set([...oursLines, ...theirsLines]);
    return Array.from(merged).join('\n');
  }

  generateMergeReport(resolutions: MergeResolution[]): string {
    const lines = [
      'Merge Conflict Resolution Report',
      '================================',
      '',
      `Total conflicts resolved: ${resolutions.length}`,
      '',
    ];

    const byStrategy = new Map<string, number>();
    for (const r of resolutions) {
      byStrategy.set(r.strategy, (byStrategy.get(r.strategy) ?? 0) + 1);
    }

    lines.push('By strategy:');
    for (const [strategy, count] of byStrategy) {
      lines.push(`  ${strategy}: ${count}`);
    }
    lines.push('');

    for (let i = 0; i < resolutions.length; i++) {
      const r = resolutions[i]!;
      lines.push(`Conflict ${i + 1}:`);
      lines.push(`  Strategy: ${r.strategy}`);
      lines.push(`  Lines: ${r.conflict.startLine}-${r.conflict.endLine}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

export function createCollaborativeTool() {
  return {
    name: 'collaborative',
    description: 'Code review simulation, PR comments, and merge conflict resolution',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['review', 'pr_summary', 'resolve_conflict'],
          description: 'Collaborative operation to perform',
        },
        file: { type: 'string', description: 'File to review or resolve' },
        content: { type: 'string', description: 'File content for review or conflict resolution' },
        strategy: {
          type: 'string',
          enum: ['ours', 'theirs', 'auto', 'manual'],
          description: 'Merge strategy for conflict resolution',
        },
        resolution: { type: 'string', description: 'Manual resolution content' },
      },
      required: ['operation'],
    },
    riskLevel: 'read' as const,
    isIdempotent: true,
    execute: async (params: Record<string, unknown>, ctx: { workspaceRoot: string }) => {
      const operation = params.operation as string;
      const file = params.file as string | undefined;
      const content = params.content as string | undefined;
      const strategy = (params.strategy as string) ?? 'auto';
      const resolution = params.resolution as string | undefined;

      const engine = new CollaborativeEngine();

      try {
        switch (operation) {
          case 'review': {
            if (!file || !content) {
              return {
                success: false,
                output: '',
                error: 'review requires file and content parameters',
              };
            }
            const comments = engine.simulateCodeReview(file, content);
            const inlineComments = engine.generateInlineComments(comments);
            return {
              success: true,
              output: engine.generatePRSummary(comments),
              metadata: { comments, inlineComments },
            };
          }

          case 'pr_summary': {
            if (!content) {
              return {
                success: false,
                output: '',
                error: 'pr_summary requires content parameter',
              };
            }
            const comments = engine.simulateCodeReview(file ?? 'unknown', content);
            return {
              success: true,
              output: engine.generatePRSummary(comments),
              metadata: { comments },
            };
          }

          case 'resolve_conflict': {
            if (!content) {
              return {
                success: false,
                output: '',
                error: 'resolve_conflict requires content parameter',
              };
            }
            const conflicts = engine.parseConflict(content);
            const resolutions = conflicts.map((c) =>
              engine.resolveConflict(c, strategy as 'ours' | 'theirs' | 'auto', resolution),
            );
            const resolved = resolutions.map((r) => r.resolution).join('\n\n');
            return {
              success: true,
              output: engine.generateMergeReport(resolutions),
              metadata: { conflicts, resolutions, resolved },
            };
          }

          default:
            return {
              success: false,
              output: '',
              error: `Unknown operation: ${operation}`,
            };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
