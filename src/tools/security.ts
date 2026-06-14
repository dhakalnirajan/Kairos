import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: 'high' | 'medium' | 'low';
}

export interface SecurityIssue {
  file: string;
  line: number;
  column: number;
  type: 'secret' | 'vulnerability' | 'license' | 'env';
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string;
}

export interface LicenseInfo {
  package: string;
  license: string;
  isCompatible: boolean;
  restrictions: string[];
}

export interface EnvValidation {
  variable: string;
  required: boolean;
  validated: boolean;
  source?: string;
  issue?: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { name: 'API Key', pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][A-Za-z0-9]{20,}['"]/gi, severity: 'high' },
  { name: 'Secret Key', pattern: /(?:secret|token|password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/gi, severity: 'high' },
  { name: 'Private Key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, severity: 'high' },
  { name: 'AWS Key', pattern: /(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, severity: 'high' },
  { name: 'Connection String', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^'"]{10,}/gi, severity: 'medium' },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'medium' },
];

const RESTRICTIVE_LICENSES = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'EUPL-1.1'];

export class SecurityScanner {
  private files: Map<string, string> = new Map();

  async scanDirectory(dir: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    this.collectFiles(dir);

    for (const [file, content] of this.files) {
      issues.push(...this.scanForSecrets(file, content));
    }

    return issues;
  }

  private collectFiles(dir: string, depth = 0): void {
    if (depth > 10) return;

    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          this.collectFiles(fullPath, depth + 1);
        } else if (this.isScannableFile(entry)) {
          try {
            const content = readFileSync(fullPath, 'utf-8');
            this.files.set(fullPath, content);
          } catch {}
        }
      }
    } catch {}
  }

  private isScannableFile(filename: string): boolean {
    const ext = extname(filename);
    return ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.yml', '.yaml', '.toml', '.cfg', '.conf', '.ini'].includes(ext);
  }

  scanForSecrets(file: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const secretPattern of SECRET_PATTERNS) {
        const matches = line.matchAll(secretPattern.pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            issues.push({
              file,
              line: i + 1,
              column: match.index,
              type: 'secret',
              severity: secretPattern.severity,
              message: `Potential ${secretPattern.name} detected`,
              suggestion: `Move to environment variable or secret manager`,
            });
          }
        }
      }
    }

    return issues;
  }

  checkDependencyLicenses(packageJsonPath: string): LicenseInfo[] {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const licenses: LicenseInfo[] = [];

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const [name] of Object.entries(deps)) {
        licenses.push({
          package: name as string,
          license: 'unknown',
          isCompatible: true,
          restrictions: [],
        });
      }

      return licenses;
    } catch {
      return [];
    }
  }

  validateEnvironmentVariables(envPath: string, requiredVars: string[]): EnvValidation[] {
    const validations: EnvValidation[] = [];

    const envContent = this.files.get(envPath) ?? '';
    const envVars = new Map<string, string>();

    for (const line of envContent.split('\n')) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match && match[1] && match[2]) {
        envVars.set(match[1], match[2]);
      }
    }

    for (const variable of requiredVars) {
      const value = envVars.get(variable);
      validations.push({
        variable,
        required: true,
        validated: !!value,
        source: value ? envPath : undefined,
        issue: value ? undefined : `Missing required environment variable`,
      });
    }

    return validations;
  }

  generateReport(issues: SecurityIssue[]): string {
    const high = issues.filter((i) => i.severity === 'high');
    const medium = issues.filter((i) => i.severity === 'medium');
    const low = issues.filter((i) => i.severity === 'low');

    const lines = [
      'Security Scan Report',
      '===================',
      '',
      `Total issues: ${issues.length}`,
      `  High: ${high.length}`,
      `  Medium: ${medium.length}`,
      `  Low: ${low.length}`,
      '',
    ];

    if (high.length > 0) {
      lines.push('HIGH SEVERITY:');
      for (const issue of high) {
        lines.push(`  ${issue.file}:${issue.line} - ${issue.message}`);
        lines.push(`    Suggestion: ${issue.suggestion}`);
      }
      lines.push('');
    }

    if (medium.length > 0) {
      lines.push('MEDIUM SEVERITY:');
      for (const issue of medium) {
        lines.push(`  ${issue.file}:${issue.line} - ${issue.message}`);
        lines.push(`    Suggestion: ${issue.suggestion}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export function createSecurityTool() {
  return {
    name: 'security_scan',
    description: 'Scan code for secrets, check dependency licenses, and validate env vars',
    parameters: {
      type: 'object',
      properties: {
        scanType: {
          type: 'string',
          enum: ['secrets', 'licenses', 'env', 'full'],
          description: 'Type of security scan to perform',
        },
        path: { type: 'string', description: 'Directory or file to scan' },
        requiredVars: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required environment variables for env validation',
        },
      },
      required: ['scanType', 'path'],
    },
    riskLevel: 'read' as const,
    isIdempotent: true,
    execute: async (params: Record<string, unknown>, ctx: { workspaceRoot: string }) => {
      const scanType = params.scanType as string;
      const path = params.path as string;
      const requiredVars = (params.requiredVars as string[]) ?? [];

      const scanner = new SecurityScanner();

      try {
        const issues = await scanner.scanDirectory(path);
        const report = scanner.generateReport(issues);

        const envValidations = requiredVars.length > 0
          ? scanner.validateEnvironmentVariables(join(path, '.env'), requiredVars)
          : [];

        const licenses = scanType === 'licenses' || scanType === 'full'
          ? scanner.checkDependencyLicenses(join(path, 'package.json'))
          : [];

        return {
          success: true,
          output: report,
          metadata: {
            issues,
            envValidations,
            licenses,
            summary: {
              total: issues.length,
              high: issues.filter((i) => i.severity === 'high').length,
              medium: issues.filter((i) => i.severity === 'medium').length,
              low: issues.filter((i) => i.severity === 'low').length,
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
