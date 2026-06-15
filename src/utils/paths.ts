import { homedir } from 'os';
import {
  join,
  resolve,
  normalize,
  relative,
  isAbsolute as pathIsAbsolute,
  sep,
} from "path";
import { mkdirSync, realpathSync } from "fs";

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
    mkdirSync(dir, { recursive: true });
    const gitkeepPath = join(dir, ".gitkeep");
    const file = Bun.file(gitkeepPath);
    if (!await file.exists()) {
      await Bun.write(gitkeepPath, "");
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
    return resolve(join(getHomeDir(), path.slice(1)));
  }
  if (path.startsWith('$HOME')) {
    return resolve(join(getHomeDir(), path.slice(5)));
  }
  return resolve(path);
}

export function normalizePath(path: string): string {
  return normalize(path).replace(/\//g, IS_WINDOWS ? "\\" : "/");
}

export function isAbsolute(path: string): boolean {
  return pathIsAbsolute(path);
}

export function getRelativePath(from: string, to: string): string {
  return normalizePath(relative(from, to));
}

export function resolveSymlink(path: string): string {
  try {
    return normalize(realpathSync(path));
  } catch {
    return normalize(resolve(path));
  }
}

export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedRoot = normalize(resolve(workspaceRoot));
  const normalizedPath = normalize(resolve(filePath));
  const rel = relative(normalizedRoot, normalizedPath);
  return rel === "" || (!rel.startsWith(".." + sep) && !pathIsAbsolute(rel));
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
  return normalizePath(path);
}

export function normalizeEol(content: string, eol = "\n"): string {
  return normalizeLineEndings(content).replace(/\n/g, eol);
}

export async function readUtf8File(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`File not found: ${filePath}`);
  }
  return normalizeLineEndings(await file.text());
}

export async function writeUtf8File(
  filePath: string,
  content: string,
): Promise<number> {
  const encoded = new TextEncoder().encode(normalizeLineEndings(content));
  return await Bun.write(filePath, encoded);
}

export async function writeUtf8FileNormalized(
  filePath: string,
  content: string,
  eol = "\n",
): Promise<number> {
  const encoded = new TextEncoder().encode(normalizeEol(content, eol));
  return await Bun.write(filePath, encoded);
}

export class PathResolver {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = normalize(resolve(workspaceRoot));
  }

  resolvePath(path: string): string {
    if (path.startsWith("~")) {
      path = join(getHomeDir(), path.slice(1));
    } else if (path.startsWith("$HOME")) {
      path = join(getHomeDir(), path.slice(5));
    } else if (!pathIsAbsolute(path)) {
      path = join(this.workspaceRoot, path);
    }

    const resolved = resolveSymlink(path);
    if (!this.isWithinWorkspace(resolved)) {
      throw new Error(
        `Path ${path} is outside workspace root ${this.workspaceRoot}`,
      );
    }
    return resolved;
  }

  normalizePath(path: string): string {
    return normalize(path).replace(/\//g, IS_WINDOWS ? "\\" : "/");
  }

  isWithinWorkspace(path: string): boolean {
    const normalizedPath = normalize(resolve(path));
    const rel = relative(this.workspaceRoot, normalizedPath);
    return rel === "" || (!rel.startsWith(".." + sep) && !pathIsAbsolute(rel));
  }
}
