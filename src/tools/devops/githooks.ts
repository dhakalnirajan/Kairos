export interface GitHook {
  name: string;
  script: string;
  enabled: boolean;
}

export class GitHookManager {
  private hooks: Map<string, GitHook> = new Map();
  private hooksDir = '.git/hooks';

  async installHook(name: string, script: string): Promise<boolean> {
    const hookPath = `${this.hooksDir}/${name}`;
    try {
      await Bun.write(hookPath, `#!/bin/sh\n${script}`);
      return true;
    } catch {
      return false;
    }
  }

  async removeHook(name: string): Promise<boolean> {
    const hookPath = `${this.hooksDir}/${name}`;
    try {
      await Bun.file(hookPath).delete();
      return true;
    } catch {
      return false;
    }
  }

  async listHooks(): Promise<string[]> {
    try {
      const entries = await Array.fromAsync(
        new Bun.Glob('*').scan({ cwd: this.hooksDir })
      );
      return entries;
    } catch {
      return [];
    }
  }

  async getHookContent(name: string): Promise<string | null> {
    try {
      const file = Bun.file(`${this.hooksDir}/${name}`);
      if (await file.exists()) {
        return await file.text();
      }
    } catch {}
    return null;
  }

  async enableHook(name: string): Promise<boolean> {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = true;
      return true;
    }
    return false;
  }

  async disableHook(name: string): Promise<boolean> {
    const hook = this.hooks.get(name);
    if (hook) {
      hook.enabled = false;
      return true;
    }
    return false;
  }
}

export const gitHookManager = new GitHookManager();
