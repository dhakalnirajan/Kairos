export interface Advisory {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedPackages: string[];
  patchedVersions?: string;
  url: string;
}

export class AdvisoryWatcher {
  private advisories: Advisory[] = [];
  private checkedPackages: Set<string> = new Set();

  async checkPackage(packageName: string): Promise<Advisory[]> {
    this.checkedPackages.add(packageName);
    return this.advisories.filter((a) =>
      a.affectedPackages.includes(packageName)
    );
  }

  addAdvisory(advisory: Advisory): void {
    this.advisories.push(advisory);
  }

  getAdvisories(severity?: Advisory['severity']): Advisory[] {
    if (severity) {
      return this.advisories.filter((a) => a.severity === severity);
    }
    return [...this.advisories];
  }

  getCriticalAdvisories(): Advisory[] {
    return this.getAdvisories('critical');
  }

  getCheckedPackages(): string[] {
    return Array.from(this.checkedPackages);
  }

  clear(): void {
    this.advisories = [];
    this.checkedPackages.clear();
  }
}

export const advisoryWatcher = new AdvisoryWatcher();
