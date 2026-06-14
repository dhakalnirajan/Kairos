import { join } from 'path';

export type ShellType = 'powershell' | 'cmd' | 'bash' | 'zsh' | 'sh';

export function detectShell(): ShellType {
  const platform = process.platform;

  if (platform === 'win32') {
    const comSpec = process.env['ComSpec'] ?? '';
    if (comSpec.toLowerCase().includes('powershell') || comSpec.toLowerCase().includes('pwsh')) {
      return 'powershell';
    }
    return 'cmd';
  }

  const shell = process.env['SHELL'] ?? '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  return 'sh';
}

export function wrapCommand(command: string, shell?: ShellType): string[] {
  const activeShell = shell ?? detectShell();

  switch (activeShell) {
    case 'powershell':
      return ['pwsh', '-NoProfile', '-NonInteractive', '-Command', command];
    case 'cmd':
      return ['cmd', '/c', command];
    case 'bash':
      return ['bash', '-c', command];
    case 'zsh':
      return ['zsh', '-c', command];
    case 'sh':
      return ['sh', '-c', command];
    default:
      return ['sh', '-c', command];
  }
}

export function getShellExtension(): string {
  return process.platform === 'win32' ? '.ps1' : '.sh';
}

export function getShellScriptPath(name: string): string {
  const ext = getShellExtension();
  const tempDir = process.platform === 'win32'
    ? (process.env['TEMP'] ?? join(process.env['USERPROFILE'] ?? '', 'AppData', 'Local', 'Temp'))
    : '/tmp';
  return join(tempDir, `${name}${ext}`);
}

export function quoteArgument(arg: string, shell?: ShellType): string {
  const activeShell = shell ?? detectShell();

  if (activeShell === 'powershell') {
    if (arg.includes(' ') || arg.includes("'") || arg.includes('"')) {
      return `'${arg.replace(/'/g, "''")}'`;
    }
    return arg;
  }

  if (activeShell === 'cmd') {
    if (arg.includes(' ') || arg.includes('"')) {
      return `"${arg.replace(/"/g, '""')}"`;
    }
    return arg;
  }

  if (arg.includes(' ') || arg.includes("'") || arg.includes('"') || arg.includes('$')) {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return arg;
}
