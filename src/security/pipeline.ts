import type { SafetyVerdict } from '../types/tools.ts';
import type { KairosConfigOutput } from '../config/schema.ts';
import { resolve, normalize } from 'path';

const ANSI_PATTERN = /\x1b\[[0-9;]*[a-zA-Z]/g;
const NULL_BYTE = /\0/g;
const CONTROL_CHARS = /[\x00-\x08\x0E-\x1F\x7F]/g;

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|token|secret|password|passwd|pwd|auth|credential|bearer)\s*[=:]\s*['"]?([^\s'"<>]{8,})/gi,
  /(?:sk-|ghp_|gho_|github_pat_|glpat-|xox[bpas]-)[a-zA-Z0-9]{10,}/g,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/g,
];

const DESTRUCTIVE_COMMANDS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+[\/~]/i,
  /\bdel\s+\/[sq]\s+\/[a-z]/i,
  /\bformat\s+[a-zA-Z]:/i,
  /\bmkfs\b/i,
  />\s*\/dev\/sd[a-z]/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{.*\|\s*&\s*\}/,
  /\bchmod\s+-R\s+777\s+\//i,
  /\bchown\s+-R\s+.*\//i,
];

const PRIVATE_IPS = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|fc00:|fe80:)/i;

function stripControlChars(input: string): string {
  return input.replace(NULL_BYTE, '').replace(CONTROL_CHARS, '');
}

function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, '');
}

function detectDestructiveIntent(toolName: string, params: Record<string, unknown>): string | null {
  if (toolName === 'bash' || toolName === 'shell') {
    const command = String(params?.['command'] ?? '');
    for (const pattern of DESTRUCTIVE_COMMANDS) {
      if (pattern.test(command)) {
        return `Destructive command detected: ${command}`;
      }
    }
  }
  return null;
}

function classifyRisk(toolName: string, params: Record<string, unknown>): 'read' | 'write' | 'execute' | 'network' {
  const writeTools = ['write_file', 'edit_file', 'create_file', 'delete_file', 'write'];
  const executeTools = ['bash', 'shell', 'exec', 'spawn'];
  const networkTools = ['http_fetch', 'web_search', 'fetch'];

  if (writeTools.includes(toolName)) return 'write';
  if (executeTools.includes(toolName)) return 'execute';
  if (networkTools.includes(toolName)) return 'network';
  return 'read';
}

function checkPathConfinement(toolName: string, params: Record<string, unknown>, workspaceRoot: string): string | null {
  const pathParam = String(params?.['path'] ?? params?.['filePath'] ?? params?.['file'] ?? params?.['param'] ?? '');
  if (!pathParam) return null;

  const normalizedRoot = normalize(resolve(workspaceRoot));
  const resolved = normalize(resolve(pathParam));

  if (!resolved.startsWith(normalizedRoot)) {
    return `Path outside workspace: ${pathParam}`;
  }

  const blockedDirs = ['/etc', '/System', '/Windows/System32'];
  for (const dir of blockedDirs) {
    if (resolved.toLowerCase().startsWith(dir.toLowerCase())) {
      return `Access to system directory blocked: ${dir}`;
    }
  }

  return null;
}

function checkBlockedUrls(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (PRIVATE_IPS.test(parsed.hostname)) {
      return `Access to private/internal URL blocked: ${url}`;
    }
  } catch {
    if (PRIVATE_IPS.test(url)) {
      return `Access to private/internal URL blocked: ${url}`;
    }
  }
  return null;
}

function scrubSecrets(text: string): string {
  let scrubbed = text;
  for (const pattern of SECRET_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, (match) => {
      const key = match.slice(0, 8);
      return `${key}${'*'.repeat(Math.max(0, match.length - 8))}`;
    });
  }
  return scrubbed;
}

export interface AuditEntry {
  timestamp: string;
  toolName: string;
  parameters: string;
  result: string;
  duration: number;
  allowed: boolean;
  layer?: string;
}

export class SafetyPipeline {
  private auditLog: AuditEntry[] = [];

  async evaluate(
    toolName: string,
    params: Record<string, unknown>,
    riskLevel: 'read' | 'write' | 'execute' | 'network',
    config: KairosConfigOutput,
    workspaceRoot: string,
  ): Promise<SafetyVerdict> {
    if (!config.safety.enabled) {
      return { allowed: true, layer: 'safety-disabled' };
    }

    const sanitized = stripControlChars(
      Object.values(params ?? {}).filter((v): v is string => typeof v === 'string').join(' '),
    );

    if (toolName === 'bash' || toolName === 'shell') {
      const stripped = stripAnsi(sanitized);
      const blocked = config.safety.blockedCommands;
      for (const cmd of blocked) {
        if (stripped.toLowerCase().includes(cmd.toLowerCase())) {
          return { allowed: false, reason: `Blocked command: ${cmd}`, layer: 'harm-detection' };
        }
      }
    }

    const destructReason = detectDestructiveIntent(toolName, params);
    if (destructReason) {
      return { allowed: false, reason: destructReason, layer: 'harm-detection' };
    }

    const classifiedRisk = classifyRisk(toolName, params);
    if (!config.safety.allowedRiskLevels.includes(classifiedRisk)) {
      return { allowed: false, reason: `Risk level '${classifiedRisk}' not allowed`, layer: 'risk-classification' };
    }

    const pathReason = checkPathConfinement(toolName, params, workspaceRoot);
    if (pathReason) {
      return { allowed: false, reason: pathReason, layer: 'blueprint-policy' };
    }

    if (toolName === 'http_fetch' || toolName === 'web_search') {
      const url = String(params?.['url'] ?? '');
      const urlReason = checkBlockedUrls(url);
      if (urlReason) {
        return { allowed: false, reason: urlReason, layer: 'blueprint-policy' };
      }
    }

    if (config.safety.requireConfirmationFor.includes(toolName) && !config.safety.autoApprove) {
      return { allowed: false, reason: `Requires human confirmation: ${toolName}`, layer: 'hitl' };
    }

    return { allowed: true, layer: 'passed' };
  }

  async evaluateWithAudit(
    toolName: string,
    params: Record<string, unknown>,
    riskLevel: 'read' | 'write' | 'execute' | 'network',
    config: KairosConfigOutput,
    workspaceRoot: string,
  ): Promise<SafetyVerdict> {
    const start = Date.now();
    const verdict = await this.evaluate(toolName, params, riskLevel, config, workspaceRoot);
    const duration = Date.now() - start;

    const scrubbedParams = scrubSecrets(JSON.stringify(params));
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      toolName,
      parameters: scrubbedParams,
      result: verdict.allowed ? 'allowed' : `blocked: ${verdict.reason}`,
      duration,
      allowed: verdict.allowed,
      layer: verdict.layer,
    };
    this.auditLog.push(entry);

    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }

    return verdict;
  }

  getAuditLog(limit?: number): AuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }
}
