import { rename as fsRename, rm } from "node:fs/promises";

/** What Windows answers while another process has the target open, which clears once it lets go. */
const BUSY_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);

export interface ReplaceFileOptions {
  /** How many times to try before giving up. */
  attempts?: number;
  /** The wait after the first refusal; later waits grow up to five times this. */
  delayMs?: number;
  rename?: (from: string, to: string) => Promise<void>;
}

/**
 * Moves a freshly written file over its target. Windows refuses to replace a file another process
 * has open, and readers of the app's small state files open them often: the current log pointers
 * are read by several windows at the moment the app starts. Such a refusal clears in moments, so it
 * is retried for a few seconds before the error is passed on. The written file is removed if the
 * move never succeeds.
 */
export async function replaceFile(from: string, to: string, options: ReplaceFileOptions = {}): Promise<void> {
  const attempts = options.attempts ?? 20;
  const delayMs = options.delayMs ?? 50;
  const rename = options.rename ?? fsRename;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (attempt >= attempts || code === undefined || !BUSY_CODES.has(code)) {
        await rm(from, { force: true }).catch(() => {});
        throw error;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs * Math.min(attempt, 5)));
    }
  }
}
