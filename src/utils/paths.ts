import { homedir } from 'os';
import { join, resolve, normalize } from 'path';

const IS_WINDOWS = process.platform === 'win32';

export function getHomeDir(): string {
  return homedir();
}

export function getKairosDir(): string {
  const home = getHomeDir();
  if (IS_WINDOWS) {
    return join(home, 'AppData', 'Local', 'Kairos');
  }
  return join(home, '.kairos');
}

export function getConfigPath(): string {
  return join(getKairosDir(), 'config.json');
}

export function getDbPath(): string {
  return join(getKairosDir(), 'data', 'kairos.db');
}

export function getDataDir(): string {
  return join(getKairosDir(), 'data');
}

export function getCacheDir(): string {
  return join(getKairosDir(), 'cache');
}

export function getLogsDir(): string {
  return join(getKairosDir(), 'logs');
}

export function getSessionsDir(): string {
  return join(getKairosDir(), 'sessions');
}

export function getMemoryDir(): string {
  return join(getKairosDir(), 'memory');
}

export function getExtensionsDir(): string {
  return join(getKairosDir(), 'extensions');
}

export function getTempDir(): string {
  if (IS_WINDOWS) {
    const temp = process.env.TEMP || process.env.TMP;
    if (temp) {
      return join(temp, 'kairos');
    }
    return join(getHomeDir(), 'AppData', 'Local', 'Temp', 'kairos');
  }
  return '/tmp/kairos';
}

export async function ensureDir(dir: string): Promise<void> {
  try {
    const file = Bun.file(join(dir, '.gitkeep'));
    if (!await file.exists()) {
      await Bun.write(join(dir, '.gitkeep'), '');
    }
  } catch {
    // Directory might already exist or we don't have permissions
  }
}

export async function ensureAllDirs(): Promise<void> {
  const dirs = [
    getKairosDir(),
    getDataDir(),
    getCacheDir(),
    getLogsDir(),
    getSessionsDir(),
    getMemoryDir(),
    getExtensionsDir(),
    getTempDir(),
  ];
  
  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

export function resolvePath(path: string): string {
  if (path.startsWith('~')) {
    return join(getHomeDir(), path.slice(1));
  }
  if (path.startsWith('$HOME')) {
    return join(getHomeDir(), path.slice(5));
  }
  return path;
}

export function normalizePath(path: string): string {
  return path.replace(/\//g, IS_WINDOWS ? '\\' : '/');
}

export function isAbsolute(path: string): boolean {
  if (IS_WINDOWS) {
    return /^[a-zA-Z]:\\/.test(path) || /^\\\\/.test(path);
  }
  return path.startsWith('/');
}

export function getRelativePath(from: string, to: string): string {
  const fromParts = normalizePath(from).split(IS_WINDOWS ? '\\' : '/');
  const toParts = normalizePath(to).split(IS_WINDOWS ? '\\' : '/');
  
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }
  
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);
  
  const parts = [
    ...Array(upCount).fill('..'),
    ...downParts,
  ];
  
  return parts.join(IS_WINDOWS ? '\\' : '/');
}

export async function resolveSymlink(path: string): Promise<string> {
  try {
    const file = Bun.file(path);
    if (await file.exists()) {
      return normalize(resolve(path));
    }
  } catch {}
  return normalize(resolve(path));
}

export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedRoot = normalize(workspaceRoot);
  const normalizedPath = normalize(resolve(filePath));
  return normalizedPath.startsWith(normalizedRoot);
}

export function assertWithinWorkspace(filePath: string, workspaceRoot: string): void {
  if (!isWithinWorkspace(filePath, workspaceRoot)) {
    throw new Error(`Path ${filePath} is outside workspace root ${workspaceRoot}`);
  }
}

export function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function toNativePath(path: string): string {
  if (IS_WINDOWS) {
    return path.replace(/\//g, '\\');
  }
  return path.replace(/\\/g, '/');
}
