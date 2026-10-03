import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

export function claimBackendOwner(
  file: string,
  pid = process.pid,
  isAlive: (candidate: number) => boolean = processIsAlive,
): boolean {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = openSync(file, "wx");
      try { writeFileSync(handle, JSON.stringify({ pid })); } finally { closeSync(handle); }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = readOwner(file);
      if (owner !== undefined && owner !== pid && isAlive(owner)) return false;
      try { unlinkSync(file); } catch {}
    }
  }
  return false;
}

/**
 * Whether a window whose extension found the backend already taken was opened by the running app
 * or started by the player. The app opens its windows itself, each through a cmd.exe of its own,
 * so they descend from the app process that owns the backend; a second start of the app does not.
 */
export function isSecondStart(
  ownApp: number,
  owningApp: number,
  parentOf: (pid: number) => number | undefined,
  depth = 4,
): boolean {
  let ancestor = parentOf(ownApp);
  for (let level = 0; ancestor !== undefined && level < depth; level += 1) {
    if (ancestor === owningApp) return false;
    ancestor = parentOf(ancestor);
  }
  return true;
}

export function releaseBackendOwner(file: string, pid = process.pid): void {
  if (readOwner(file) !== pid) return;
  try { unlinkSync(file); } catch {}
}

export function readOwner(file: string): number | undefined {
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as { pid?: unknown };
    return typeof value.pid === "number" ? value.pid : undefined;
  } catch {
    return undefined;
  }
}

function processIsAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
