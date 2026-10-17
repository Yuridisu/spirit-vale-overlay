/**
 * DF Boss Fight: the seven Echo Masters of the Dark Fortress, on the channel the player is on.
 * Each is alive (with its health, when the game sends it), dead with its respawn countdown, or not
 * seen yet. It starts over on another channel.
 */

/** The Dark Fortress bosses, by their game id, in the order the overlay lists them. */
export const DARK_FORTRESS_BOSSES: ReadonlyArray<{ mobId: string; name: string }> = [
  { mobId: "NightmareBerserkerBoss", name: "Berserker" },
  { mobId: "NightmareGunslingerBoss", name: "Gunslinger" },
  { mobId: "NightmareNecromancerBoss", name: "Necromancer" },
  { mobId: "NightmarePaladinBoss", name: "Paladin" },
  { mobId: "NightmarePriestBoss", name: "Priest" },
  { mobId: "NightmareShinobiBoss", name: "Shinobi" },
  { mobId: "NightmareWizardBoss", name: "Wizard" },
];

const DARK_FORTRESS_IDS = new Set(DARK_FORTRESS_BOSSES.map((boss) => boss.mobId));

export function isDarkFortressBoss(mobId: string | undefined): boolean {
  return mobId !== undefined && DARK_FORTRESS_IDS.has(mobId);
}

/** A Dark Fortress boss comes back an hour after it dies (the map's boss respawn). */
export const DARK_FORTRESS_RESPAWN_MS = 60 * 60_000;

export interface BossHealth {
  current: number;
  max: number;
}

export interface DarkFortressBoss {
  mobId: string;
  name: string;
  status: "unknown" | "alive" | "dead";
  diedAtMs?: number;
  killedBy?: string;
  /** For a boss in sight, its health as the game sends it. */
  health?: BossHealth;
}

export interface DarkFortressState {
  /** The channel these bosses are on; the list starts over on another one. */
  channel?: number;
  region?: string;
  bosses: DarkFortressBoss[];
}

/** When a dead boss respawns. */
export function darkFortressRespawnAtMs(boss: Pick<DarkFortressBoss, "diedAtMs">): number | undefined {
  return boss.diedAtMs === undefined ? undefined : boss.diedAtMs + DARK_FORTRESS_RESPAWN_MS;
}
