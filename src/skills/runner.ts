import { join } from 'path';
import { getKairosDir } from '../utils/paths.ts';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';

export interface Skill {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tools: string[];
  permissions: { allow: string[]; ask: string[] };
  dependencies: Record<string, string>;
  entrypoint: string;
  content: string;
  path: string;
}

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  error?: string;
}

export class SkillRunner {
  private skills: Map<string, Skill> = new Map();
  private skillsDir: string;

  constructor(skillsDir?: string) {
    this.skillsDir = skillsDir ?? join(process.cwd(), 'skills');
  }

  async loadAllSkills(): Promise<Skill[]> {
    return this.loadSkills(this.skillsDir);
  }

  async loadSkills(dir: string): Promise<Skill[]> {
    const results: Skill[] = [];

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        if (statSync(fullPath).isDirectory()) {
          const skill = await this.loadSkill(fullPath);
          if (skill) {
            results.push(skill);
            this.skills.set(skill.name, skill);
          }
        }
      }
    } catch {}

    return results;
  }

  private async loadSkill(skillDir: string): Promise<Skill | null> {
    const skillMdPath = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) return null;

    const content = readFileSync(skillMdPath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) return null;

    const frontmatterYaml = frontmatterMatch[1] ?? '';
    const frontmatter = this.parseFrontmatter(frontmatterYaml);
    const skillContent = content.slice(frontmatterMatch[0].length).trim();

    return {
      name: frontmatter.name ?? skillDir.split(/[/\\]/).pop() ?? '',
      version: frontmatter.version ?? '1.0.0',
      description: frontmatter.description ?? '',
      author: frontmatter.author ?? '',
      category: frontmatter.category ?? '',
      tools: frontmatter.tools ?? [],
      permissions: frontmatter.permissions ?? { allow: [], ask: [] },
      dependencies: frontmatter.dependencies ?? {},
      entrypoint: frontmatter.entrypoint ?? 'scripts/run.ts',
      content: skillContent,
      path: skillDir,
    };
  }

  private parseFrontmatter(yaml: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = yaml.split('\n');
    let currentKey = '';
    let currentValue = '';
    let inArray = false;
    let arrayItems: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      if (trimmed.includes(':') && !trimmed.startsWith(' ')) {
        if (currentKey) {
          if (inArray) {
            result[currentKey] = arrayItems;
            arrayItems = [];
            inArray = false;
          } else {
            result[currentKey] = this.stripQuotes(currentValue.trim());
          }
        }
        const colonIndex = trimmed.indexOf(':');
        currentKey = trimmed.slice(0, colonIndex).trim();
        currentValue = trimmed.slice(colonIndex + 1).trim();

        if (currentValue === '' && !trimmed.endsWith('[]')) {
          inArray = false;
        }
      } else if (trimmed.startsWith('- ')) {
        inArray = true;
        arrayItems.push(trimmed.slice(2).trim());
      } else if (currentKey) {
        currentValue += ' ' + trimmed;
      }
    }

    if (currentKey) {
      if (inArray) {
        result[currentKey] = arrayItems;
      } else {
        result[currentKey] = this.stripQuotes(currentValue.trim());
      }
    }

    return result;
  }

  private stripQuotes(value: string): string {
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  async executeSkill(name: string, args: Record<string, string> = {}): Promise<SkillExecutionResult> {
    const skill = this.skills.get(name);
    if (!skill) {
      return { success: false, output: '', error: `Skill not found: ${name}` };
    }

    const entrypointPath = join(skill.path, skill.entrypoint);

    if (!existsSync(entrypointPath)) {
      return { success: false, output: '', error: `Entrypoint not found: ${entrypointPath}` };
    }

    try {
      const argsString = Object.entries(args)
        .map(([k, v]) => `--${k} ${v}`)
        .join(' ');

      const proc = Bun.spawn(
        ['bun', 'run', entrypointPath, ...Object.entries(args).flatMap(([k, v]) => [`--${k}`, v])],
        {
          cwd: skill.path,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      return {
        success: exitCode === 0,
        output: output.trim(),
        error: error.trim() || undefined,
      };
    } catch (e) {
      return { success: false, output: '', error: String(e) };
    }
  }

  getSkillsByCategory(category: string): Skill[] {
    return this.getAllSkills().filter(s => s.category === category);
  }

  searchSkills(query: string): Skill[] {
    const lower = query.toLowerCase();
    return this.getAllSkills().filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
    );
  }
}

export const skillRunner = new SkillRunner();
