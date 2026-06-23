export interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffResult {
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

export function computeDiff(oldText: string, newText: string, contextLines: number = 3): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const hunks: DiffHunk[] = [];
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  const lcs = longestCommonSubsequence(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  let currentHunk: DiffHunk | null = null;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && newIdx < newLines.length &&
        oldLines[oldIdx] === lcs[lcsIdx] && newLines[newIdx] === lcs[lcsIdx]) {
      unchanged++;
      if (currentHunk) {
        currentHunk.lines.push({
          type: 'context',
          content: oldLines[oldIdx]!,
          oldLine: oldIdx + 1,
          newLine: newIdx + 1,
        });
      }
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      deletions++;
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldIdx + 1,
          oldLines: 0,
          newStart: newIdx + 1,
          newLines: 0,
          lines: [],
        };
        hunks.push(currentHunk);
      }
      currentHunk.lines.push({
        type: 'removed',
        content: oldLines[oldIdx]!,
        oldLine: oldIdx + 1,
      });
      currentHunk.oldLines++;
      oldIdx++;
    } else if (newIdx < newLines.length) {
      additions++;
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldIdx + 1,
          oldLines: 0,
          newStart: newIdx + 1,
          newLines: 0,
          lines: [],
        };
        hunks.push(currentHunk);
      }
      currentHunk.lines.push({
        type: 'added',
        content: newLines[newIdx]!,
        newLine: newIdx + 1,
      });
      currentHunk.newLines++;
      newIdx++;
    }

    if (currentHunk && currentHunk.lines.length > contextLines * 2 + 1) {
      currentHunk = null;
    }
  }

  return { hunks, stats: { additions, deletions, unchanged } };
}

function longestCommonSubsequence(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]!);
      i--;
      j--;
    } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

export function formatDiff(diff: DiffResult): string {
  const lines: string[] = [];

  for (const hunk of diff.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

    for (const line of hunk.lines) {
      switch (line.type) {
        case 'added':
          lines.push(`\x1b[32m+ ${line.content}\x1b[0m`);
          break;
        case 'removed':
          lines.push(`\x1b[31m- ${line.content}\x1b[0m`);
          break;
        case 'context':
          lines.push(`  ${line.content}`);
          break;
      }
    }
  }

  return lines.join('\n');
}

export function applyDiff(original: string, diff: DiffResult): string {
  const lines = original.split('\n');
  const result: string[] = [];

  let oldIdx = 0;
  for (const hunk of diff.hunks) {
    while (oldIdx < hunk.oldStart - 1) {
      result.push(lines[oldIdx]!);
      oldIdx++;
    }

    for (const line of hunk.lines) {
      switch (line.type) {
        case 'added':
          result.push(line.content);
          break;
        case 'removed':
          oldIdx++;
          break;
        case 'context':
          result.push(line.content);
          oldIdx++;
          break;
      }
    }
  }

  while (oldIdx < lines.length) {
    result.push(lines[oldIdx]!);
    oldIdx++;
  }

  return result.join('\n');
}
