/**
 * Echoing Spire: the climb through the Eternal Tower (105 floors, a boss every fifth one). The run
 * follows the Spire's maps, and the floor its monsters' level gives; each floor keeps its time, kills
 * and gains, a boss floor its boss's health, fight and damage, and the Umbral curse its warnings.
 */
import type { BossHealth } from "./dark-fortress.ts";

export const ECHOING_SPIRE_FLOORS = 105;
/** The Spire's own maps ("The Echoing Spire"); the Spire Entrance (51) is outside it. */
export const ECHOING_SPIRE_MAP_IDS: ReadonlySet<number> = new Set([49, 50]);
/** A floor's monsters (and a boss floor's boss) are this much above the floor in level: floor 1 is 101. */
export const ECHOING_SPIRE_LEVEL_OFFSET = 100;
/** Every fifth floor is a boss floor. */
export const ECHOING_SPIRE_BOSS_EVERY = 5;

/** The monster the Umbral Curse leaves behind when what carries it dies. */
export const CURSE_MANIFESTATION_MOB_ID = "NightmareShadow";
export const UMBRAL_CURSE_STATUS_ID = "UmbralCurse";
/** Raises the damage its bearer takes; the Curse Manifestation's Umbral Rupture leaves it. */
export const UMBRAL_MARK_STATUS_ID = "UmbralMark";

export function isSpireBossFloor(floor: number | undefined): boolean {
  return floor !== undefined && floor > 0 && floor % ECHOING_SPIRE_BOSS_EVERY === 0;
}

/** The next boss floor at or above this one. */
export function nextSpireBossFloor(floor: number): number {
  return Math.min(ECHOING_SPIRE_FLOORS, Math.ceil(Math.max(1, floor) / ECHOING_SPIRE_BOSS_EVERY) * ECHOING_SPIRE_BOSS_EVERY);
}

export interface EchoingSpireBossKill {
  name: string;
  /** From its first hit to its death, when both were seen. */
  fightMs?: number;
  /** Everyone's damage to it. */
  damage?: number;
}

export interface EchoingSpireFloor {
  floor: number;
  startedAtMs: number;
  /** When the next floor's banner came, or the run left the Spire. */
  endedAtMs?: number;
  /** Monsters that died in sight on this floor, whoever killed them. */
  kills: number;
  experience: number;
  coins: number;
  bosses: EchoingSpireBossKill[];
}

export interface EchoingSpireRun {
  startedAtMs: number;
  /** Set while the player is outside the Spire; the run carries on if they are back within a minute. */
  leftAtMs?: number;
  /** Set once the run is over. */
  endedAtMs?: number;
  /** Oldest first; the last one is the floor the player is on. */
  floors: EchoingSpireFloor[];
  kills: number;
  experience: number;
  coins: number;
}

export interface EchoingSpireRunSummary {
  startedAtMs: number;
  endedAtMs: number;
  firstFloor?: number;
  lastFloor?: number;
  kills: number;
  experience: number;
}

/** A boss on the floor the player is on. */
export interface EchoingSpireBoss {
  name: string;
  status: "alive" | "dead";
  health?: BossHealth;
  firstHitAtMs?: number;
  diedAtMs?: number;
}

export interface EchoingSpireCurse {
  /** Curse Manifestations in sight. */
  manifestations: number;
  /** Other players in sight carrying the Umbral Curse. */
  cursedPlayers: number;
  /** The player carries the Umbral Curse. */
  selfCursed: boolean;
  /** The player carries the Umbral Mark, and takes more damage. */
  marked: boolean;
  markExpiresAtMs?: number;
}

export interface EchoingSpireState {
  inSpire: boolean;
  floor?: number;
  run?: EchoingSpireRun;
  bosses: EchoingSpireBoss[];
  curse: EchoingSpireCurse;
  /** Earlier runs this session, newest first. */
  history: EchoingSpireRunSummary[];
}
