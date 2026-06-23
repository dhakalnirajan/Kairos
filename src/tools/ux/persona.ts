import type { ToolInstance, ToolContext, ToolResult } from '../../types/tools.ts';

export interface PersonaProfile {
  id: string;
  name: string;
  description: string;
  behavioralModifiers: string[];
  promptTemplate: string;
}

const PERSONA_PROFILES: Record<string, PersonaProfile> = {
  auditor: {
    id: 'auditor',
    name: 'Security Auditor',
    description: 'Focuses on security vulnerabilities, code quality, and compliance',
    behavioralModifiers: [
      'Be skeptical and question assumptions',
      'Look for edge cases and failure modes',
      'Verify claims with evidence',
      'Report findings with severity ratings',
      'Suggest mitigations for each issue',
    ],
    promptTemplate: `You are a Security Auditor. Your role is to analyze code and systems for vulnerabilities.
Be thorough but focused. Rate findings by severity (Critical/High/Medium/Low).
Always suggest concrete mitigations. Verify claims before reporting.`,
  },
  hacker: {
    id: 'hacker',
    name: 'Creative Hacker',
    description: 'Thinks laterally, finds unconventional solutions, exploits system properties',
    behavioralModifiers: [
      'Think outside conventional patterns',
      'Look for clever shortcuts and exploits',
      'Challenge assumptions about what is possible',
      'Prioritize novel approaches over safe ones',
      'Consider adversarial perspectives',
    ],
    promptTemplate: `You are a Creative Hacker. Think unconventionally. Find shortcuts, exploits, and novel solutions.
Question every assumption. Consider how systems can be bent or repurposed.
Favor cleverness and efficiency over convention. Think like an adversary.`,
  },
  teacher: {
    id: 'teacher',
    name: 'Technical Teacher',
    description: 'Explains concepts clearly, provides learning-oriented guidance',
    behavioralModifiers: [
      'Explain the why, not just the what',
      'Build understanding incrementally',
      'Use analogies and examples',
      'Check for comprehension',
      'Encourage experimentation',
    ],
    promptTemplate: `You are a Technical Teacher. Explain concepts clearly and build understanding.
Start with fundamentals, then layer complexity. Use analogies.
Encourage questions and hands-on experimentation. Make learning engaging.`,
  },
};

export class PersonaManager {
  private activePersona: PersonaProfile | null = null;
  private customProfiles: Map<string, PersonaProfile> = new Map();

  getProfile(id: string): PersonaProfile | undefined {
    return PERSONA_PROFILES[id] ?? this.customProfiles.get(id);
  }

  getAllProfiles(): PersonaProfile[] {
    return [...Object.values(PERSONA_PROFILES), ...Array.from(this.customProfiles.values())];
  }

  setActive(personaId: string): boolean {
    const profile = this.getProfile(personaId);
    if (!profile) return false;
    this.activePersona = profile;
    return true;
  }

  getActive(): PersonaProfile | null {
    return this.activePersona;
  }

  clearActive(): void {
    this.activePersona = null;
  }

  addCustomProfile(profile: PersonaProfile): void {
    this.customProfiles.set(profile.id, profile);
  }

  removeCustomProfile(id: string): boolean {
    return this.customProfiles.delete(id);
  }

  buildPrompt(context: string): string {
    if (!this.activePersona) return context;

    const modifiers = this.activePersona.behavioralModifiers
      .map((m) => `- ${m}`)
      .join('\n');

    return `${this.activePersona.promptTemplate}\n\nBehavioral modifiers:\n${modifiers}\n\nTask:\n${context}`;
  }

  listProfiles(): string {
    const lines: string[] = ['Available Personas:', ''];

    for (const profile of Object.values(PERSONA_PROFILES)) {
      const active = this.activePersona?.id === profile.id ? ' (ACTIVE)' : '';
      lines.push(`  ${profile.id}: ${profile.description}${active}`);
    }

    if (this.customProfiles.size > 0) {
      lines.push('', 'Custom Personas:');
      for (const profile of this.customProfiles.values()) {
        const active = this.activePersona?.id === profile.id ? ' (ACTIVE)' : '';
        lines.push(`  ${profile.id}: ${profile.description}${active}`);
      }
    }

    return lines.join('\n');
  }
}

export const personaManager = new PersonaManager();

export const personaTool: ToolInstance = {
  name: 'persona',
  description: 'Manage agent personas with behavioral modifiers and prompt templates (auditor, hacker, teacher)',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'set', 'clear', 'get', 'build_prompt'],
        description: 'Action to perform',
      },
      personaId: { type: 'string', description: 'Persona ID for set/get actions' },
      context: { type: 'string', description: 'Context to build prompt with (for build_prompt)' },
      modifiers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional behavioral modifiers (for set with custom)',
      },
    },
    required: ['action'],
  },
  riskLevel: 'read',
  isIdempotent: true,

  async execute(params: Record<string, unknown>, _ctx: ToolContext): Promise<ToolResult> {
    const action = String(params['action'] ?? '');

    switch (action) {
      case 'list': {
        return {
          success: true,
          output: personaManager.listProfiles(),
          metadata: {
            profiles: personaManager.getAllProfiles().map((p) => p.id),
            active: personaManager.getActive()?.id ?? null,
          },
        };
      }

      case 'set': {
        const personaId = String(params['personaId'] ?? '');
        const modifiers = params['modifiers'] as string[] | undefined;

        if (!personaId) {
          return { success: false, output: '', error: 'personaId required' };
        }

        const existing = personaManager.getProfile(personaId);
        if (!existing && modifiers) {
          personaManager.addCustomProfile({
            id: personaId,
            name: personaId,
            description: 'Custom persona',
            behavioralModifiers: modifiers,
            promptTemplate: `You are ${personaId}. Follow these behavioral guidelines.`,
          });
        }

        const success = personaManager.setActive(personaId);
        if (!success) {
          return { success: false, output: '', error: `Persona "${personaId}" not found` };
        }

        const active = personaManager.getActive()!;
        return {
          success: true,
          output: `Activated persona: ${active.name}\n${active.description}\n\nModifiers:\n${active.behavioralModifiers.map((m) => `  - ${m}`).join('\n')}`,
          metadata: { personaId: active.id },
        };
      }

      case 'clear': {
        personaManager.clearActive();
        return { success: true, output: 'Persona cleared' };
      }

      case 'get': {
        const active = personaManager.getActive();
        if (!active) {
          return { success: true, output: 'No active persona' };
        }
        return {
          success: true,
          output: `Active persona: ${active.name}\n${active.description}\n\nTemplate:\n${active.promptTemplate}\n\nModifiers:\n${active.behavioralModifiers.map((m) => `  - ${m}`).join('\n')}`,
          metadata: { personaId: active.id },
        };
      }

      case 'build_prompt': {
        const context = String(params['context'] ?? '');
        const prompt = personaManager.buildPrompt(context);
        return {
          success: true,
          output: prompt,
          metadata: { hasActivePersona: personaManager.getActive() !== null },
        };
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  },
};
