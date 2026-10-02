import type { BossFightPlayer, BossFightReport } from "@svoverlay/contracts/boss-fight";

/** One player's damage to the bosses of the current fight. */
export interface BossFightRow {
  name: string;
  archetype?: number;
  damage: number;
}

export interface BossFightState {
  /** Every boss hit during the fight, in the order they were first hit. */
  bossNames: string[];
  totalDamage: number;
  /** From the first hit on a boss to the latest one. */
  durationMs: number;
  /** False once every boss is dead or the fight has gone quiet. */
  active: boolean;
  rows: BossFightRow[];
}

/** Boss damage this long apart belongs to two different fights. */
const IDLE_GAP_MS = 30_000;
const MAX_ROWS = 12;
/** Loot spawning this soon after a boss dies is taken to be that boss's. */
const DROP_WINDOW_MS = 5_000;
const MAX_KEPT_FIGHTS = 30;

interface PlayerTally extends Omit<BossFightPlayer, "skills"> {
  skills: Map<string, { label: string; damage: number; hits: number; crits: number }>;
}

interface Fight {
  id: string;
  startedAtMs: number;
  lastDamageAtMs: number;
  /** Boss object id -> name, for the bosses still standing. */
  alive: Map<number, string>;
  bossNames: string[];
  mapName?: string;
  totalDamage: number;
  players: Map<string, PlayerTally>;
  lastBossDeathAtMs?: number;
  drops: Map<string, { name: string; rarity?: number; count: number }>;
  countedDrops: Set<number>;
}

/**
 * Follows the damage players deal to bosses, apart from everything else they hit.
 *
 * A fight opens with the first hit on a boss and takes in every boss hit while it runs, so a
 * double-boss encounter is one fight. It closes when every boss hit has died or no boss has been
 * hit for a while. Finished fights are kept, newest last, for the Combat window to look back on.
 */
export class BossFightTracker {
  private fight: Fight | undefined;
  private readonly finished: BossFightReport[] = [];

  /** Seeds the fights of earlier sessions, oldest first. */
  constructor(history: readonly BossFightReport[] = []) {
    this.finished.push(...history.slice(-MAX_KEPT_FIGHTS).map((report) => ({ ...report, active: false })));
  }

  observeDamage(
    boss: { objectId: number; name: string },
    player: { name: string; archetype?: number },
    hit: number | { damage: number; label?: string; critical?: boolean },
    nowMs: number,
  ): void {
    const { damage, label = "Unknown", critical = false } = typeof hit === "number" ? { damage: hit } : hit;
    if (!Number.isFinite(damage) || damage <= 0) return;
    let fight = this.fight;
    if (!fight || this.ended(fight, nowMs)) {
      this.archive(nowMs);
      fight = {
        id: `${nowMs}-${boss.objectId}`,
        startedAtMs: nowMs,
        lastDamageAtMs: nowMs,
        alive: new Map(),
        bossNames: [],
        totalDamage: 0,
        players: new Map(),
        drops: new Map(),
        countedDrops: new Set(),
      };
      this.fight = fight;
    }
    fight.lastDamageAtMs = nowMs;
    fight.alive.set(boss.objectId, boss.name);
    if (!fight.bossNames.includes(boss.name)) fight.bossNames.push(boss.name);
    fight.totalDamage += damage;

    const tally = this.player(fight, player.name);
    if (player.archetype !== undefined) tally.archetype = player.archetype;
    tally.damage += damage;
    tally.hits += 1;
    if (critical) tally.crits += 1;
    const skill = tally.skills.get(label) ?? { label, damage: 0, hits: 0, crits: 0 };
    skill.damage += damage;
    skill.hits += 1;
    if (critical) skill.crits += 1;
    tally.skills.set(label, skill);
  }

  /** Names the map the fight in progress is on; the first name given stands. */
  observeMap(mapName: string | undefined): void {
    if (this.fight && this.fight.mapName === undefined && mapName !== undefined) this.fight.mapName = mapName;
  }

  /** Drops every finished fight. One in progress carries on. */
  clearHistory(): void {
    this.finished.length = 0;
  }

  observeDeath(bossObjectId: number, nowMs = 0): void {
    if (this.fight?.alive.delete(bossObjectId)) this.fight.lastBossDeathAtMs = nowMs;
  }

  /** A player who dies while a fight is running; one who never hit the boss is listed all the same. */
  observePlayerDeath(name: string, nowMs: number): void {
    const fight = this.fight;
    if (!fight || this.ended(fight, nowMs)) return;
    this.player(fight, name).deaths += 1;
  }

  /** Loot appearing right after a boss dies. Returns whether it was counted as that boss's. */
  observeDrop(drop: { objectId: number; name: string; rarity?: number }, nowMs: number): boolean {
    const fight = this.fight;
    if (!fight || fight.lastBossDeathAtMs === undefined) return false;
    if (nowMs - fight.lastBossDeathAtMs > DROP_WINDOW_MS || fight.countedDrops.has(drop.objectId)) return false;
    fight.countedDrops.add(drop.objectId);
    const key = `${drop.name}\u0000${drop.rarity ?? ""}`;
    const entry = fight.drops.get(key) ?? { name: drop.name, ...(drop.rarity === undefined ? {} : { rarity: drop.rarity }), count: 0 };
    entry.count += 1;
    fight.drops.set(key, entry);
    return true;
  }

  /** Forgets the fight in progress, as on a map change; finished fights are kept. */
  reset(nowMs = 0): void {
    this.archive(nowMs);
    this.fight = undefined;
  }

  state(nowMs: number): BossFightState | undefined {
    const fight = this.fight;
    if (!fight) return undefined;
    return {
      bossNames: [...fight.bossNames],
      totalDamage: fight.totalDamage,
      durationMs: fight.lastDamageAtMs - fight.startedAtMs,
      active: !this.ended(fight, nowMs),
      rows: [...fight.players.values()]
        .filter((player) => player.damage > 0)
        .sort((left, right) => right.damage - left.damage || left.name.localeCompare(right.name))
        .slice(0, MAX_ROWS)
        .map((player) => ({
          name: player.name,
          ...(player.archetype === undefined ? {} : { archetype: player.archetype }),
          damage: player.damage,
        })),
    };
  }

  /** Every fight on record, newest first, the one in progress included. */
  reports(nowMs: number): BossFightReport[] {
    const current = this.fight ? [this.report(this.fight, nowMs)] : [];
    return [...current, ...[...this.finished].reverse()];
  }

  private player(fight: Fight, name: string): PlayerTally {
    let tally = fight.players.get(name);
    if (!tally) {
      tally = { name, damage: 0, hits: 0, crits: 0, deaths: 0, skills: new Map() };
      fight.players.set(name, tally);
    }
    return tally;
  }

  private archive(nowMs: number): void {
    if (!this.fight) return;
    this.finished.push({ ...this.report(this.fight, nowMs), active: false });
    if (this.finished.length > MAX_KEPT_FIGHTS) this.finished.splice(0, this.finished.length - MAX_KEPT_FIGHTS);
    this.fight = undefined;
  }

  private report(fight: Fight, nowMs: number): BossFightReport {
    return {
      id: fight.id,
      bossNames: [...fight.bossNames],
      ...(fight.mapName === undefined ? {} : { mapName: fight.mapName }),
      startedAtMs: fight.startedAtMs,
      durationMs: fight.lastDamageAtMs - fight.startedAtMs,
      totalDamage: fight.totalDamage,
      active: !this.ended(fight, nowMs),
      defeated: fight.alive.size === 0,
      players: [...fight.players.values()]
        .sort((left, right) => right.damage - left.damage || left.name.localeCompare(right.name))
        .map((player) => ({
          name: player.name,
          ...(player.archetype === undefined ? {} : { archetype: player.archetype }),
          damage: player.damage,
          hits: player.hits,
          crits: player.crits,
          deaths: player.deaths,
          skills: [...player.skills.values()].sort((left, right) => right.damage - left.damage).map((skill) => ({ ...skill })),
        })),
      drops: [...fight.drops.values()]
        .sort((left, right) => (right.rarity ?? 0) - (left.rarity ?? 0) || left.name.localeCompare(right.name))
        .map((drop) => ({ ...drop })),
    };
  }

  private ended(fight: Fight, nowMs: number): boolean {
    return fight.alive.size === 0 || nowMs - fight.lastDamageAtMs >= IDLE_GAP_MS;
  }
}
