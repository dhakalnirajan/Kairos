import { join } from 'path';
import { getKairosDir } from '../utils/paths.ts';

export interface Skill {
  name: string;
  description: string;
  trigger?: string;
  content: string;
  steps?: SkillStep[];
}

export interface SkillStep {
  action: string;
  params?: Record<string, unknown>;
  condition?: string;
}

export class SkillRunner {
  private skills: Map<string, Skill> = new Map();

  async loadSkills(dir?: string): Promise<Skill[]> {
    const skillsDir = dir ?? join(getKairosDir(), 'skills');
    const results: Skill[] = [];

    try {
      const entries = await Array.fromAsync(
        new Bun.Glob('*.{md,yaml,yml}').scan({ cwd: skillsDir })
      );

      for (const entry of entries) {
        try {
          const skill = await this.loadSkill(join(skillsDir, entry));
          if (skill) {
            results.push(skill);
            this.skills.set(skill.name, skill);
          }
        } catch {}
      }
    } catch {}

    return results;
  }

  private async loadSkill(filePath: string): Promise<Skill | null> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const content = await file.text();
    const name = filePath.split(/[/\\]/).pop()?.replace(/\.(md|yaml|yml)$/, '') ?? '';

    let description = '';
    let trigger = '';

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('name:')) {
        const skillName = trimmed.slice(5).trim();
        if (skillName) return { name: skillName, description, trigger, content };
      } else if (trimmed.startsWith('description:')) {
        description = trimmed.slice(12).trim();
      } else if (trimmed.startsWith('trigger:')) {
        trigger = trimmed.slice(8).trim();
      }
    }

    return { name, description, trigger, content };
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
}
