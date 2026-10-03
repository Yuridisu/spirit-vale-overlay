/** One skill or attack a player used on the bosses of a fight. */
export interface BossFightSkill {
  label: string;
  damage: number;
  hits: number;
  crits: number;
}

export interface BossFightPlayer {
  name: string;
  archetype?: number;
  damage: number;
  hits: number;
  crits: number;
  /** Times this player died while the fight was running. */
  deaths: number;
  /** Largest first. */
  skills: BossFightSkill[];
}

/** Loot that appeared on the ground as a boss died. */
export interface BossFightDrop {
  name: string;
  rarity?: number;
  count: number;
}

/** One boss of a fight with several, and what each player dealt to that boss alone. */
export interface BossFightBoss {
  /** The boss's name; a second boss of the same name is numbered, as "Kraken 2". */
  name: string;
  /** From the first hit on this boss to the latest one. */
  durationMs: number;
  totalDamage: number;
  defeated: boolean;
  /** Ranked by damage to this boss. Deaths are the player's deaths in the whole fight. */
  players: BossFightPlayer[];
}

/** Everything recorded about one boss fight, for the overlay's meter and the Combat window's analysis. */
export interface BossFightReport {
  id: string;
  /** Every boss hit during the fight, in the order they were first hit. */
  bossNames: string[];
  /** The map the fight took place on, when it was known. */
  mapName?: string;
  /** Wall-clock time of the first hit on a boss. */
  startedAtMs: number;
  /** From the first hit on a boss to the latest one. */
  durationMs: number;
  totalDamage: number;
  /** False once every boss is dead or the fight has gone quiet. */
  active: boolean;
  /** True when every boss that was hit died, rather than the fight going quiet. */
  defeated: boolean;
  /** Ranked by damage to the bosses. */
  players: BossFightPlayer[];
  /** Each boss on its own, in the order they were first hit; only when the fight had more than one. */
  bosses?: BossFightBoss[];
  drops: BossFightDrop[];
}
