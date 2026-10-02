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

interface Fight {
  startedAtMs: number;
  lastDamageAtMs: number;
  /** Boss object id -> name, for the bosses still standing. */
  alive: Map<number, string>;
  bossNames: string[];
  totalDamage: number;
  players: Map<string, BossFightRow>;
}

/**
 * Follows the damage players deal to bosses, apart from everything else they hit.
 *
 * A fight opens with the first hit on a boss and takes in every boss hit while it runs, so a
 * double-boss encounter is one fight. It closes when every boss hit has died or no boss has been
 * hit for a while, and stays on show until the next fight replaces it.
 */
export class BossFightTracker {
  private fight: Fight | undefined;

  observeDamage(
    boss: { objectId: number; name: string },
    player: { name: string; archetype?: number },
    damage: number,
    nowMs: number,
  ): void {
    if (!Number.isFinite(damage) || damage <= 0) return;
    let fight = this.fight;
    if (!fight || this.ended(fight, nowMs)) {
      fight = { startedAtMs: nowMs, lastDamageAtMs: nowMs, alive: new Map(), bossNames: [], totalDamage: 0, players: new Map() };
      this.fight = fight;
    }
    fight.lastDamageAtMs = nowMs;
    fight.alive.set(boss.objectId, boss.name);
    if (!fight.bossNames.includes(boss.name)) fight.bossNames.push(boss.name);
    fight.totalDamage += damage;
    const row = fight.players.get(player.name) ?? { name: player.name, damage: 0 };
    row.damage += damage;
    if (player.archetype !== undefined) row.archetype = player.archetype;
    fight.players.set(player.name, row);
  }

  observeDeath(bossObjectId: number): void {
    this.fight?.alive.delete(bossObjectId);
  }

  reset(): void {
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
        .sort((left, right) => right.damage - left.damage || left.name.localeCompare(right.name))
        .slice(0, MAX_ROWS)
        .map((row) => ({ ...row })),
    };
  }

  private ended(fight: Fight, nowMs: number): boolean {
    return fight.alive.size === 0 || nowMs - fight.lastDamageAtMs >= IDLE_GAP_MS;
  }
}
