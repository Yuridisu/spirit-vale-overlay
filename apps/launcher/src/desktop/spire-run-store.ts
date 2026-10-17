import { readFile } from "node:fs/promises";

import type { EchoingSpireRun } from "@svoverlay/contracts/echoing-spire";
import { writeJsonFileAtomic } from "@svoverlay/desktop-platform/json-settings";

interface PersistedSpireRuns {
  cacheVersion: 1;
  /** Newest first. */
  runs: EchoingSpireRun[];
}

/** Reads the Echoing Spire runs of earlier sessions, newest first; a missing or unreadable file is none. */
export async function loadSpireRuns(file: string): Promise<EchoingSpireRun[]> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as Partial<PersistedSpireRuns>;
    if (value.cacheVersion !== 1 || !Array.isArray(value.runs)) return [];
    return value.runs.filter(isRun);
  } catch {
    return [];
  }
}

export async function saveSpireRuns(runs: readonly EchoingSpireRun[], file: string): Promise<void> {
  await writeJsonFileAtomic(file, { cacheVersion: 1, runs: [...runs] } satisfies PersistedSpireRuns);
}

/** Changes once a floor, a boss or a run does, not on every kill: when the runs are worth saving. */
export function spireRunsSignature(runs: readonly EchoingSpireRun[]): string {
  return runs.map((run) => {
    const bosses = run.floors.reduce((total, floor) => total + floor.bosses.length, 0);
    return `${run.startedAtMs}:${run.floors.length}:${bosses}:${run.endedAtMs ?? ""}`;
  }).join("|");
}

function isRun(value: unknown): value is EchoingSpireRun {
  const run = value as Partial<EchoingSpireRun> | null;
  return typeof run === "object" && run !== null
    && typeof run.startedAtMs === "number"
    && Array.isArray(run.floors)
    && run.floors.every((floor) => typeof floor?.floor === "number" && typeof floor.startedAtMs === "number" && Array.isArray(floor.bosses));
}
