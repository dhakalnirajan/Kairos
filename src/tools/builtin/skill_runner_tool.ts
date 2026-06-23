import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';
import { SkillRunner } from '../../skills/runner.ts';

let runner: SkillRunner | null = null;

function getRunner(): SkillRunner {
  if (!runner) {
    runner = new SkillRunner();
  }
  return runner;
}

async function ensureLoaded(): Promise<void> {
  const r = getRunner();
  if (r.getAllSkills().length === 0) {
    await r.loadAllSkills();
  }
}

export const skillRunnerTool: ToolInstance = {
  name: 'skill_runner',
  description: 'List, search, or execute skills. Skills are specialized workflows (e.g. tdd, code-review, debug, security) that perform multi-step tasks. Use action="list" to see available skills, action="search" to find skills by query, action="info" to get details on a skill, or action="run" to execute a skill with arguments.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'search', 'info', 'run'],
        description: 'list: show all skills. search: find skills by keyword. info: get skill details. run: execute a skill.',
      },
      query: {
        type: 'string',
        description: 'Search query (for search action) or skill name (for info/run actions).',
      },
      args: {
        type: 'object',
        description: 'Arguments to pass to the skill script (for run action). Keys become --key value CLI args.',
      },
    },
    required: ['action'],
  },
  riskLevel: 'execute',
  isIdempotent: false,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params.action ?? 'list');
    const query = String(params.query ?? '');
    const args = (params.args ?? {}) as Record<string, string>;

    try {
      await ensureLoaded();
      const r = getRunner();

      switch (action) {
        case 'list': {
          const skills = r.getAllSkills();
          if (skills.length === 0) {
            return { success: true, output: 'No skills found. Ensure skills/ directory exists with SKILL.md files.' };
          }
          const lines = skills.map(s => `  ${s.name} (${s.category}) - ${s.description}`);
          return { success: true, output: `${skills.length} skills available:\n${lines.join('\n')}` };
        }

        case 'search': {
          if (!query) return { success: false, output: '', error: 'search requires a query parameter' };
          const results = r.searchSkills(query);
          if (results.length === 0) {
            return { success: true, output: `No skills matching "${query}"` };
          }
          const lines = results.map(s => `  ${s.name} (${s.category}) - ${s.description}`);
          return { success: true, output: `${results.length} skills matching "${query}":\n${lines.join('\n')}` };
        }

        case 'info': {
          if (!query) return { success: false, output: '', error: 'info requires a query (skill name)' };
          const skill = r.getSkill(query);
          if (!skill) return { success: false, output: '', error: `Skill not found: ${query}` };
          const info = [
            `Name: ${skill.name}`,
            `Version: ${skill.version}`,
            `Category: ${skill.category}`,
            `Description: ${skill.description}`,
            `Author: ${skill.author}`,
            `Tools needed: ${skill.tools.join(', ') || 'none declared'}`,
            `Entrypoint: ${skill.entrypoint}`,
            `Path: ${skill.path}`,
          ].join('\n');
          return { success: true, output: info };
        }

        case 'run': {
          if (!query) return { success: false, output: '', error: 'run requires a query (skill name)' };
          const result = await r.executeSkill(query, args);
          return {
            success: result.success,
            output: result.output,
            error: result.error,
          };
        }

        default:
          return { success: false, output: '', error: `Unknown action: ${action}. Use list, search, info, or run.` };
      }
    } catch (e) {
      return { success: false, output: '', error: String(e) };
    }
  },
};
