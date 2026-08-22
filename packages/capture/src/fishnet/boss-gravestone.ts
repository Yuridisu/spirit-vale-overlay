/** Reads the marker the server spawns where a world boss died. */

import type { DecodedFishNetPacket } from "./types.ts";

/** Fields the marker reports, resolved from its `BossKillInfo` SyncType. */
export interface BossGravestone {
  /** Catalog id of the boss, e.g. `Sunflora Pixie`. The same id the timers are keyed on. */
  mobId: string;
  /** Display name of the boss, e.g. `Lady Fey`. */
  bossName: string;
  /** Player the marker credits with the kill. */
  killedBy: string;
  /** When the server says the boss died, rather than when we happened to see the marker. */
  diedAtMs: number;
}

/** Reads `packet` as a gravestone, or returns undefined when it is any other spawned object. */
export function decodeBossGravestone(packet: DecodedFishNetPacket): BossGravestone | undefined {
  const entry = packet.spawnSyncEntries?.find((candidate) => candidate.networkBehaviourType === "BossGraveStone");
  if (!entry) return undefined;

  const killTime = entry.fields.find((field) => field.name === "KillTime")?.value;
  const killerName = entry.fields.find((field) => field.name === "KillerName")?.value;
  const bossName = entry.fields.find((field) => field.name === "BossName")?.value;
  const bossId = entry.fields.find((field) => field.name === "BossId")?.value;
  if (typeof killTime !== "number" || typeof killerName !== "string" || typeof bossName !== "string"
    || typeof bossId !== "string") {
    return undefined;
  }

  // Seconds as a float64, which is how the server sends it.
  return { mobId: bossId, bossName, killedBy: killerName, diedAtMs: killTime * 1_000 };
}
