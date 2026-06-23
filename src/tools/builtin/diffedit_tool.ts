import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { computeDiff, formatDiff } from '../analysis/diff.ts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const diffEditTool: ToolInstance = {
  name: 'diff_edit',
  description: 'Diff-based editing: three-way merge, hunk-based edits, conflict resolution, inline diff preview',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['diff', 'three_way_merge', 'apply_hunk', 'resolve_conflict', 'preview_edit'], description: 'Diff action' },
      path: { type: 'string', description: 'File path' },
      old_content: { type: 'string', description: 'Original content' },
      new_content: { type: 'string', description: 'New content' },
      base_content: { type: 'string', description: 'Base content for three-way merge' },
      theirs_content: { type: 'string', description: 'Theirs content for three-way merge' },
      hunk_index: { type: 'number', description: 'Hunk index to apply' },
    },
    required: ['action'],
  },
  riskLevel: 'write' as const,
  isIdempotent: false,

  async execute(params: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'diff': {
          const filePath = String(params['path'] ?? '');
          const oldContent = String(params['old_content'] ?? '');
          const newContent = String(params['new_content'] ?? '');
          if (!oldContent || !newContent) return { success: false, output: '', error: 'old_content and new_content required' };
          const diff = computeDiff(oldContent, newContent);
          const formatted = formatDiff(diff);
          return { success: true, output: formatted, metadata: { additions: diff.stats.additions, deletions: diff.stats.deletions, hunks: diff.hunks.length } };
        }
        case 'three_way_merge': {
          const base = String(params['base_content'] ?? '');
          const ours = String(params['old_content'] ?? '');
          const theirs = String(params['theirs_content'] ?? '');
          if (!base || !ours || !theirs) return { success: false, output: '', error: 'base_content, old_content (ours), and theirs_content required' };
          const baseLines = base.split('\n');
          const oursLines = ours.split('\n');
          const theirsLines = theirs.split('\n');
          const merged: string[] = [];
          const conflicts: Array<{ line: number; ours: string; theirs: string }> = [];
          const maxLen = Math.max(baseLines.length, oursLines.length, theirsLines.length);
          for (let i = 0; i < maxLen; i++) {
            const b = baseLines[i];
            const o = oursLines[i] ?? '';
            const t = theirsLines[i] ?? '';
            if (o === t) merged.push(o);
            else if (o === b) merged.push(t);
            else if (t === b) merged.push(o);
            else { merged.push(`<<<<<<< OURS\n${o}\n=======\n${t}\n>>>>>>> THEIRS`); conflicts.push({ line: i + 1, ours: o, theirs: t }); }
          }
          return { success: conflicts.length === 0, output: merged.join('\n'), metadata: { conflicts: conflicts.length, merged: merged.length } };
        }
        case 'apply_hunk': {
          const filePath = String(params['path'] ?? '');
          const newContent = String(params['new_content'] ?? '');
          const hunkIdx = Number(params['hunk_index'] ?? 0);
          if (!filePath || !newContent) return { success: false, output: '', error: 'path and new_content required' };
          const resolved = existsSync(filePath) ? filePath : join(ctx.workspaceRoot, filePath);
          if (!existsSync(resolved)) return { success: false, output: '', error: `File not found: ${filePath}` };
          const current = readFileSync(resolved, 'utf-8');
          const diff = computeDiff(current, newContent);
          if (hunkIdx >= diff.hunks.length) return { success: false, output: '', error: `Hunk index ${hunkIdx} out of range (max: ${diff.hunks.length - 1})` };
          const hunk = diff.hunks[hunkIdx]!;
          const lines = current.split('\n');
          const newLines = newContent.split('\n');
          lines.splice(hunk.newStart - 1, hunk.oldLines, ...newLines.slice(hunk.newStart - 1, hunk.newStart - 1 + hunk.newLines));
          writeFileSync(resolved, lines.join('\n'));
          return { success: true, output: `Applied hunk ${hunkIdx} to ${filePath}`, metadata: { hunk: hunkIdx } };
        }
        case 'resolve_conflict': {
          const filePath = String(params['path'] ?? '');
          const resolution = String(params['new_content'] ?? '');
          if (!filePath || !resolution) return { success: false, output: '', error: 'path and new_content (resolution) required' };
          const resolved = existsSync(filePath) ? filePath : join(ctx.workspaceRoot, filePath);
          writeFileSync(resolved, resolution);
          return { success: true, output: `Resolved conflicts in ${filePath}` };
        }
        case 'preview_edit': {
          const oldContent = String(params['old_content'] ?? '');
          const newContent = String(params['new_content'] ?? '');
          if (!oldContent || !newContent) return { success: false, output: '', error: 'old_content and new_content required' };
          const diff = computeDiff(oldContent, newContent);
          const preview = formatDiff(diff);
          return { success: true, output: preview, metadata: { additions: diff.stats.additions, deletions: diff.stats.deletions } };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Diff edit failed: ${e}` };
    }
  },
};
