import { join } from 'path';
import { getKairosDir, getTempDir } from '../utils/paths.ts';
import { eventBus, type EventType } from './bus.ts';
import type { KairosConfigOutput } from '../config/schema.ts';

export interface Hook {
  name: string;
  event: EventType;
  script: string;
  enabled: boolean;
}

export class HookRunner {
  private hooks: Hook[] = [];
  private config: KairosConfigOutput;

  constructor(config: KairosConfigOutput) {
    this.config = config;
  }

  async loadHooks(): Promise<void> {
    if (!this.config.hooks.enabled) return;

    const hooksDir = join(getKairosDir(), 'hooks');

    try {
      const entries = await Array.fromAsync(
        new Bun.Glob('*.sh').scan({ cwd: hooksDir })
      );

      for (const entry of entries) {
        const hook = await this.loadHook(join(hooksDir, entry));
        if (hook) {
          this.hooks.push(hook);
        }
      }
    } catch {}

    this.registerHandlers();
  }

  private async loadHook(filePath: string): Promise<Hook | null> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) return null;

    const content = await file.text();
    const name = filePath.split(/[/\\]/).pop()?.replace('.sh', '') ?? '';

    let event: EventType = 'post_turn';
    if (content.includes('# @event pre_tool')) event = 'pre_tool_execution';
    else if (content.includes('# @event post_tool')) event = 'post_tool_execution';
    else if (content.includes('# @event error')) event = 'on_error';
    else if (content.includes('# @event pre_commit')) event = 'pre_commit';

    return {
      name,
      event,
      script: content,
      enabled: !content.includes('# @disabled'),
    };
  }

  private registerHandlers(): void {
    for (const hook of this.hooks) {
      if (!hook.enabled) continue;

      eventBus.on(hook.event, async (payload) => {
        await this.executeHook(hook, payload.data);
      });
    }
  }

  private async executeHook(hook: Hook, data: Record<string, unknown>): Promise<void> {
    try {
      const tempDir = getTempDir();
      const tempPath = join(tempDir, `hook-${hook.name}-${Date.now()}.sh`);
      await Bun.write(tempPath, hook.script);

      const proc = Bun.spawn(['sh', tempPath], {
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          KAIROS_HOOK_EVENT: hook.event,
          KAIROS_HOOK_DATA: JSON.stringify(data),
        },
      });

      await proc.exited;
      await Bun.file(tempPath).delete();
    } catch {}
  }

  async runPreHooks(toolName: string, params: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
    if (!this.config.hooks.enabled) {
      return { success: true };
    }

    try {
      await eventBus.emit('pre_tool_execution', { toolName, ...params });
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  async runPostHooks(toolName: string, result: unknown): Promise<{ success: boolean; error?: string }> {
    if (!this.config.hooks.enabled) {
      return { success: true };
    }

    try {
      await eventBus.emit('post_tool_execution', { toolName, result });
      return { success: true };
    } catch (e) {
      return { success: false, error: String(e) };
    }
  }

  getHooks(): Hook[] {
    return [...this.hooks];
  }

  getHooksForEvent(event: EventType): Hook[] {
    return this.hooks.filter((h) => h.event === event && h.enabled);
  }
}

export function createHookRunner(config: KairosConfigOutput): HookRunner {
  return new HookRunner(config);
}
