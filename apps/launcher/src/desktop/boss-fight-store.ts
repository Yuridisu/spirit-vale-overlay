import { readFile } from "node:fs/promises";

import type { BossFightReport } from "@svoverlay/contracts/boss-fight";
import { writeJsonFileAtomic } from "@svoverlay/desktop-platform/json-settings";

interface PersistedBossFights {
  cacheVersion: 1;
  /** Oldest first. */
  fights: BossFightReport[];
}

/** Reads the fights of earlier sessions, oldest first; a missing or unreadable file is no history. */
export async function loadBossFights(file: string): Promise<BossFightReport[]> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as Partial<PersistedBossFights>;
    if (value.cacheVersion !== 1 || !Array.isArray(value.fights)) return [];
    return value.fights.filter(isReport);
  } catch {
    return [];
  }
}

export async function saveBossFights(fights: readonly BossFightReport[], file: string): Promise<void> {
  await writeJsonFileAtomic(file, { cacheVersion: 1, fights: [...fights] } satisfies PersistedBossFights);
}

function isReport(value: unknown): value is BossFightReport {
  const report = value as Partial<BossFightReport> | null;
  return typeof report === "object" && report !== null
    && typeof report.id === "string"
    && Array.isArray(report.bossNames)
    && Array.isArray(report.players)
    && Array.isArray(report.drops)
    && typeof report.totalDamage === "number"
    && typeof report.startedAtMs === "number"
    && typeof report.durationMs === "number";
}
