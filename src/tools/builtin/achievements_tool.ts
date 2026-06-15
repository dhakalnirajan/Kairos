import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { achievementSystem } from '../achievements.ts';

export const achievementsTool: ToolInstance = {
  name: 'achievements',
  description: 'Achievement and badge tracking: milestones, badges, progress tracking',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add_milestone', 'add_badge', 'check_milestone', 'earn_badge', 'milestones', 'badges', 'unlocked', 'to_ascii'], description: 'Achievement action' },
      id: { type: 'string', description: 'Milestone/badge ID' },
      name: { type: 'string', description: 'Display name' },
      description_text: { type: 'string', description: 'Description' },
      icon: { type: 'string', description: 'Badge icon' },
      criteria: { type: 'string', description: 'Comma-separated criteria' },
    },
    required: ['action'],
  },
  riskLevel: 'read' as const,
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    try {
      switch (action) {
        case 'add_milestone': {
          const id = String(params['id'] ?? `ms-${Date.now()}`);
          const name = String(params['name'] ?? id);
          const description = String(params['description_text'] ?? '');
          const criteriaStr = String(params['criteria'] ?? '');
          const criteria = criteriaStr ? criteriaStr.split(',').map((c) => c.trim()) : [];
          achievementSystem.addMilestone({ id, name, description, criteria, completed: false });
          return { success: true, output: `Added milestone: ${name}` };
        }
        case 'add_badge': {
          const id = String(params['id'] ?? `badge-${Date.now()}`);
          const name = String(params['name'] ?? id);
          const icon = String(params['icon'] ?? '★');
          const description = String(params['description_text'] ?? '');
          achievementSystem.addBadge({ id, name, icon, description });
          return { success: true, output: `Added badge: ${name}` };
        }
        case 'check_milestone': {
          const id = String(params['id'] ?? '');
          if (!id) return { success: false, output: '', error: 'id required' };
          const completed = achievementSystem.checkMilestone(id);
          return { success: true, output: completed ? `Milestone ${id} completed!` : `Milestone ${id} not yet complete` };
        }
        case 'earn_badge': {
          const id = String(params['id'] ?? '');
          if (!id) return { success: false, output: '', error: 'id required' };
          const earned = achievementSystem.earnBadge(id);
          return { success: true, output: earned ? `Badge earned: ${id}!` : 'Badge not earned yet' };
        }
        case 'milestones': {
          const milestones = achievementSystem.getMilestones();
          const output = milestones.map((m) => `${m.completed ? '✓' : '○'} ${m.name}: ${m.description}`).join('\n');
          return { success: true, output: output || 'No milestones', metadata: { count: milestones.length } };
        }
        case 'badges': {
          const badges = achievementSystem.getBadges();
          const output = badges.map((b) => `${b.icon} ${b.name}: ${b.description}`).join('\n');
          return { success: true, output: output || 'No badges', metadata: { count: badges.length } };
        }
        case 'unlocked': {
          const unlocked = achievementSystem.getUnlockedBadges();
          const output = unlocked.map((b) => `${b.icon} ${b.name}`).join('\n');
          return { success: true, output: output || 'No unlocked badges', metadata: { count: unlocked.length } };
        }
        case 'to_ascii': {
          return { success: true, output: achievementSystem.toAscii() };
        }
        default:
          return { success: false, output: '', error: `Unknown action: ${action}` };
      }
    } catch (e) {
      return { success: false, output: '', error: `Achievements failed: ${e}` };
    }
  },
};
