import { join } from 'path';
import { getExtensionsDir } from '../utils/paths.ts';
import type { ToolInstance } from '../types/tools.ts';
import type { KairosConfigOutput } from '../config/schema.ts';

export interface Extension {
  manifest: { name: string; version: string; skills?: string[]; tools?: string[] };
  enabled: boolean;
  path: string;
}

export class ExtensionLoader {
  private config: KairosConfigOutput;
  private extensions: Map<string, Extension> = new Map();

  constructor(config: KairosConfigOutput) {
    this.config = config;
  }

  async discover(): Promise<Extension[]> {
    if (!this.config.extensions.enabled) return [];

    const searchPaths = this.config.extensions.searchPaths.length > 0
      ? this.config.extensions.searchPaths
      : [getExtensionsDir()];

    const results: Extension[] = [];

    for (const searchPath of searchPaths) {
      try {
        const entries = await Array.fromAsync(
          new Bun.Glob('*/manifest.json').scan({ cwd: searchPath })
        );

        for (const entry of entries) {
          const manifestPath = join(searchPath, entry);
          const file = Bun.file(manifestPath);
          if (!(await file.exists())) continue;

          const manifest = (await file.json()) as Extension['manifest'];
          const isDisabled = this.config.extensions.disabled.includes(manifest.name);

          const ext: Extension = {
            manifest,
            enabled: !isDisabled,
            path: join(searchPath, entry.replace('/manifest.json', '')),
          };

          results.push(ext);
          this.extensions.set(manifest.name, ext);
        }
      } catch {}
    }

    return results;
  }

  getExtension(name: string): Extension | undefined {
    return this.extensions.get(name);
  }

  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  async loadTools(extension: Extension, registry: { register: (tool: ToolInstance) => void }): Promise<void> {
    const manifest = extension.manifest as Record<string, unknown>;
    const tools = manifest['tools'] as Array<Record<string, unknown>> | undefined;

    if (!tools) return;

    for (const toolDef of tools) {
      const name = `ext_${extension.manifest.name}_${toolDef['name']}`;
      const description = toolDef['description'] as string ?? '';
      const parameters = toolDef['parameters'] as Record<string, unknown> ?? {};
      const riskLevel = (toolDef['riskLevel'] as 'read' | 'write' | 'execute' | 'network') ?? 'read';
      const handlerFile = toolDef['handler'] as string | undefined;

      let handler: ((params: Record<string, unknown>) => Promise<unknown>) | undefined;

      if (handlerFile) {
        const handlerPath = join(extension.path, handlerFile);
        try {
          const mod = await import(handlerPath);
          handler = mod.default ?? mod.handler;
        } catch {}
      }

      registry.register({
        name,
        description,
        parameters: parameters as any,
        riskLevel,
        isIdempotent: true,
        execute: async (params) => {
          if (handler) {
            const result = await handler(params);
            return { success: true, output: JSON.stringify(result) };
          }
          return { success: true, output: `Tool ${name} executed` };
        },
      });
    }
  }
}

export interface Plugin {
  name: string;
  version: string;
  tools: ToolInstance[];
  hooks?: Record<string, (data: unknown) => void>;
}

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();

  async loadAll(): Promise<Plugin[]> {
    const pluginsDir = getExtensionsDir();
    const results: Plugin[] = [];

    try {
      const dir = Bun.file(join(pluginsDir, '.gitkeep'));
      if (!(await dir.exists())) return results;

      const entries = await Array.fromAsync(
        new Bun.Glob('*/package.json').scan({ cwd: pluginsDir })
      );

      for (const entry of entries) {
        try {
          const plugin = await this.loadPlugin(join(pluginsDir, entry));
          if (plugin) {
            results.push(plugin);
            this.plugins.set(plugin.name, plugin);
          }
        } catch {}
      }
    } catch {}

    return results;
  }

  private async loadPlugin(pluginDir: string): Promise<Plugin | null> {
    const pkgPath = join(pluginDir, 'package.json');
    const pkgFile = Bun.file(pkgPath);
    if (!(await pkgFile.exists())) return null;

    const pkg = (await pkgFile.json()) as Record<string, unknown>;
    const name = pkg['name'] as string;
    const version = pkg['version'] as string;
    const main = pkg['main'] as string ?? 'index.js';

    const modulePath = join(pluginDir, main);
    const mod = await import(modulePath);

    return {
      name,
      version,
      tools: mod.tools ?? [],
      hooks: mod.hooks,
    };
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

export const pluginLoader = new PluginLoader();
