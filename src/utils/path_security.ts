import {
  join,
  resolve,
  normalize,
  relative,
  isAbsolute as pathIsAbsolute,
  sep,
} from "path";
import { homedir } from "os";
import { realpathSync } from "fs";

export function sanitizePath(p: string): string {
  return p
    .replace(/\0/g, "")
    .replace(/\.\./g, "")
    .replace(/[<>:"|?*]/g, "");
}

export function resolveSymlink(path: string): string {
  try {
    return normalize(realpathSync(path));
  } catch {
    return normalize(resolve(path));
  }
}

export function isWithinWorkspace(
  filePath: string,
  workspaceRoot: string,
): boolean {
  const normalizedRoot = normalize(resolve(workspaceRoot));
  const normalizedPath = normalize(resolve(filePath));
  const rel = relative(normalizedRoot, normalizedPath);
  return rel === "" || (!rel.startsWith(".." + sep) && !pathIsAbsolute(rel));
}

export function assertWithinWorkspace(
  filePath: string,
  workspaceRoot: string,
): void {
  if (!isWithinWorkspace(filePath, workspaceRoot)) {
    throw new Error(
      `Path ${filePath} is outside workspace root ${workspaceRoot}`,
    );
  }
}

export function resolveFilePath(p: string, workspaceRoot: string): string {
  let candidate: string;

  if (p.startsWith("~")) {
    candidate = join(homedir(), p.slice(1));
  } else if (p.startsWith("$HOME")) {
    candidate = join(homedir(), p.slice(5));
  } else if (pathIsAbsolute(p)) {
    candidate = p;
  } else {
    candidate = join(workspaceRoot, p);
  }

  const resolved = resolveSymlink(candidate);
  assertWithinWorkspace(resolved, workspaceRoot);
  return resolved;
}

export function isPathSafe(filePath: string, workspaceRoot: string): boolean {
  try {
    resolveFilePath(filePath, workspaceRoot);
    return true;
  } catch {
    return false;
  }
}
