import { join, resolve, normalize, isAbsolute } from 'path';
import { homedir } from 'os';

const IS_WINDOWS = process.platform === 'win32';
const WORKSPACE_ROOT = process.cwd();

export function resolveFilePath(p: string, workspaceRoot: string): string {
  let resolved: string;

  if (p.startsWith('~')) {
    resolved = join(homedir(), p.slice(1));
  } else if (p.match(/^[a-zA-Z]:\\/)) {
    resolved = p;
  } else if (p.startsWith('/')) {
    resolved = p;
  } else {
    resolved = join(workspaceRoot, p);
  }

  const normalizedRoot = normalize(workspaceRoot);
  const normalizedResolved = normalize(resolve(resolved));

  if (!normalizedResolved.startsWith(normalizedRoot)) {
    throw new Error(`Path traversal detected: ${p} resolves outside workspace`);
  }

  return normalizedResolved;
}

export function isPathSafe(filePath: string, workspaceRoot: string): boolean {
  try {
    const normalizedRoot = normalize(workspaceRoot);
    let normalizedPath: string;

    if (filePath.startsWith('~')) {
      normalizedPath = normalize(join(homedir(), filePath.slice(1)));
    } else if (!isAbsolute(filePath)) {
      normalizedPath = normalize(join(workspaceRoot, filePath));
    } else {
      normalizedPath = normalize(filePath);
    }

    return normalizedPath.startsWith(normalizedRoot);
  } catch {
    return false;
  }
}

export function sanitizePath(p: string): string {
  return p
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '');
}
