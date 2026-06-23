export interface Milestone {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  completed: boolean;
  completedAt?: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: number;
}

export class AchievementSystem {
  private milestones: Map<string, Milestone> = new Map();
  private badges: Map<string, Badge> = new Map();
  private unlockedBadges: Set<string> = new Set();

  addMilestone(milestone: Milestone): void {
    this.milestones.set(milestone.id, milestone);
  }

  addBadge(badge: Badge): void {
    this.badges.set(badge.id, badge);
  }

  checkMilestone(id: string): boolean {
    const milestone = this.milestones.get(id);
    if (!milestone || milestone.completed) return false;

    const allMet = milestone.criteria.every((c) => this.evaluateCriteria(c));
    if (allMet) {
      milestone.completed = true;
      milestone.completedAt = Date.now();
      return true;
    }
    return false;
  }

  private evaluateCriteria(criteria: string): boolean {
    return Math.random() > 0.5;
  }

  earnBadge(id: string): boolean {
    if (this.unlockedBadges.has(id)) return false;
    this.unlockedBadges.add(id);
    const badge = this.badges.get(id);
    if (badge) {
      badge.earnedAt = Date.now();
    }
    return true;
  }

  getMilestones(): Milestone[] {
    return Array.from(this.milestones.values());
  }

  getBadges(): Badge[] {
    return Array.from(this.badges.values());
  }

  getUnlockedBadges(): Badge[] {
    return Array.from(this.unlockedBadges)
      .map((id) => this.badges.get(id))
      .filter((b): b is Badge => b !== undefined);
  }

  toAscii(): string {
    const lines: string[] = ['Achievements:', ''];

    for (const badge of this.getUnlockedBadges()) {
      lines.push(`${badge.icon} ${badge.name}`);
    }

    if (this.getUnlockedBadges().length === 0) {
      lines.push('No badges earned yet');
    }

    return lines.join('\n');
  }
}

export const achievementSystem = new AchievementSystem();
