export interface Alias {
  name: string;
  expansion: string;
  description?: string;
}

export class AliasManager {
  private aliases: Map<string, Alias> = new Map();

  addAlias(name: string, expansion: string, description?: string): void {
    this.aliases.set(name, { name, expansion, description });
  }

  removeAlias(name: string): boolean {
    return this.aliases.delete(name);
  }

  getAlias(name: string): Alias | undefined {
    return this.aliases.get(name);
  }

  expand(text: string): string {
    let expanded = text;
    for (const [name, alias] of this.aliases) {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      expanded = expanded.replace(regex, alias.expansion);
    }
    return expanded;
  }

  listAliases(): Alias[] {
    return Array.from(this.aliases.values());
  }

  hasAlias(name: string): boolean {
    return this.aliases.has(name);
  }

  clear(): void {
    this.aliases.clear();
  }
}

export const aliasManager = new AliasManager();
