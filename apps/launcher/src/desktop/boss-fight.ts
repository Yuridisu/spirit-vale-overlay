import type { BossFightPlayer, BossFightReport } from "@svoverlay/contracts/boss-fight";
import type { BossHealth } from "@svoverlay/contracts/dark-fortress";

/** One player's damage to the bosses on show. */
export interface BossFightRow {
  name: string;
  archetype?: number;
  damage: number;
}

export interface BossFightState {
  /** Every boss on show, in the order they were first hit. */
  bossNames: string[];
  totalDamage: number;
  /** From the first hit on a boss to the latest one. */
  durationMs: number;
  /** False once the boss on show is dead or its fight has gone quiet. */
  active: boolean;
  rows: BossFightRow[];
  /** For a finished fight still on show: how long until it leaves the overlay. */
  closesInMs?: number;
  /** The boss's health, for a single boss in sight. */
  health?: BossHealth;
  /** Each boss on its own, when more than one is being fought at once. */
  bosses?: Array<{ name: string; totalDamage: number; durationMs: number; alive: boolean; rows: BossFightRow[]; health?: BossHealth }>;
}

/** Boss damage this long apart belongs to two different fights. */
const IDLE_GAP_MS = 30_000;
const MAX_ROWS = 12;
/** Loot spawning this soon after a boss dies is taken to be that boss's. */
const DROP_WINDOW_MS = 5_000;
/** An Echo gauntlet alone is seven bosses, so this keeps a good few runs. */
const MAX_KEPT_FIGHTS = 100;
/** A finished fight stays on the overlay this long, counting down, then leaves it. */
const SHOW_FINISHED_MS = 30_000;

interface PlayerTally extends Omit<BossFightPlayer, "skills"> {
  skills: Map<string, { label: string; damage: number; hits: number; crits: number }>;
}

/** One boss, from its first hit to its death or a long quiet spell. */
interface Fight {
  id: string;
  objectId: number;
  name: string;
  startedAtMs: number;
  lastDamageAtMs: number;
  mapName?: string;
  totalDamage: number;
  players: Map<string, PlayerTally>;
  diedAtMs?: number;
  drops: Map<string, { name: string; rarity?: number; count: number }>;
  countedDrops: Set<number>;
}

/**
 * Follows the damage players deal to bosses, apart from everything else they hit.
 *
 * Every boss is a fight of its own, from its first hit to its death or a long quiet spell, even
 * when several are fought at once (an Echo gauntlet brings them in one after another). The overlay
 * shows the bosses still standing; a dead one leaves it, and only the last to fall stays on show,
 * counting down for a while, unless another boss is hit first. Finished fights are kept, newest
 * last, for the Combat window.
 */
export class BossFightTracker {
  /** Boss object id -> its fight, until the fight is put away. */
  private readonly open = new Map<number, Fight>();
  /** The fight most recently put away, still on show while no other boss is. */
  private latest: Fight | undefined;
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
    this.putAwayFinished(nowMs);
    let fight = this.open.get(boss.objectId);
    if (fight && this.ended(fight, nowMs)) {
      this.archive(fight, nowMs);
      fight = undefined;
    }
    if (!fight) {
      fight = {
        id: `${nowMs}-${boss.objectId}`,
        objectId: boss.objectId,
        name: boss.name,
        startedAtMs: nowMs,
        lastDamageAtMs: nowMs,
        totalDamage: 0,
        players: new Map(),
        drops: new Map(),
        countedDrops: new Set(),
      };
      this.open.set(boss.objectId, fight);
    }
    fight.lastDamageAtMs = nowMs;
    fight.totalDamage += damage;

    const tally = this.player(fight.players, player.name);
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

  /**
   * Drops the fight on a "boss" that turned out to fight on the players' side (a necromancer's
   * Reanimation keeps the boss it raised), with every hit counted on it. Returns whether anything
   * changed.
   */
  forgetBoss(bossObjectId: number): boolean {
    return this.open.delete(bossObjectId);
  }

  /** Names the map of the fights in progress; the first name given to each stands. */
  observeMap(mapName: string | undefined): void {
    if (mapName === undefined) return;
    for (const fight of this.open.values()) if (fight.mapName === undefined) fight.mapName = mapName;
  }

  /** Drops every finished fight. The ones in progress carry on. */
  clearHistory(): void {
    this.finished.length = 0;
  }

  observeDeath(bossObjectId: number, nowMs = 0): void {
    const fight = this.open.get(bossObjectId);
    if (fight && fight.diedAtMs === undefined) fight.diedAtMs = nowMs;
  }

  /** A player who dies while bosses are being fought counts in each; one who never hit is listed all the same. */
  observePlayerDeath(name: string, nowMs: number): void {
    for (const fight of this.live(nowMs)) this.player(fight.players, name).deaths += 1;
  }

  /** Loot appearing right after a boss dies. Returns whether it was counted as that boss's. */
  observeDrop(drop: { objectId: number; name: string; rarity?: number }, nowMs: number): boolean {
    // The boss that fell last is the one whose loot this is.
    let fight: Fight | undefined;
    for (const candidate of this.open.values()) {
      if (candidate.diedAtMs === undefined || nowMs - candidate.diedAtMs > DROP_WINDOW_MS) continue;
      if (!fight || candidate.diedAtMs >= fight.diedAtMs!) fight = candidate;
    }
    if (!fight || fight.countedDrops.has(drop.objectId)) return false;
    fight.countedDrops.add(drop.objectId);
    const key = `${drop.name}\u0000${drop.rarity ?? ""}`;
    const entry = fight.drops.get(key) ?? { name: drop.name, ...(drop.rarity === undefined ? {} : { rarity: drop.rarity }), count: 0 };
    entry.count += 1;
    fight.drops.set(key, entry);
    return true;
  }

  /** Forgets the fights in progress, as on a map change; finished fights are kept. */
  reset(nowMs = 0): void {
    for (const fight of [...this.open.values()]) this.archive(fight, nowMs);
    this.latest = undefined;
  }

  /** Whether this boss is being fought, so a change in its health is worth showing. */
  isFighting(bossObjectId: number): boolean {
    return this.open.has(bossObjectId);
  }

  state(nowMs: number, healthOf: (bossObjectId: number) => BossHealth | undefined = () => undefined): BossFightState | undefined {
    const live = this.live(nowMs);
    if (live.length === 0) {
      // With no boss standing, the one that fell last stays on show for a while.
      const shown = this.lastFinished();
      if (!shown) return undefined;
      const closesInMs = finishedAt(shown) + SHOW_FINISHED_MS - nowMs;
      return closesInMs > 0 ? { ...fightState(shown, false), closesInMs } : undefined;
    }
    if (live.length === 1) {
      const health = healthOf(live[0]!.objectId);
      return { ...fightState(live[0]!, true), ...(health ? { health } : {}) };
    }
    const players = new Map<string, PlayerTally>();
    for (const fight of live) {
      for (const tally of fight.players.values()) {
        const whole = this.player(players, tally.name);
        if (tally.archetype !== undefined) whole.archetype = tally.archetype;
        whole.damage += tally.damage;
      }
    }
    const names = numberedNames(live);
    return {
      bossNames: [...new Set(live.map((fight) => fight.name))],
      totalDamage: live.reduce((sum, fight) => sum + fight.totalDamage, 0),
      durationMs: Math.max(...live.map((fight) => fight.lastDamageAtMs)) - Math.min(...live.map((fight) => fight.startedAtMs)),
      active: true,
      rows: meterRows(players),
      bosses: live.map((fight, index) => {
        const health = healthOf(fight.objectId);
        return {
          name: names[index]!,
          totalDamage: fight.totalDamage,
          durationMs: fight.lastDamageAtMs - fight.startedAtMs,
          alive: true,
          rows: meterRows(fight.players),
          ...(health ? { health } : {}),
        };
      }),
    };
  }

  /**
   * When what state() shows next changes with no new event: a boss fight going quiet, or a
   * finished one leaving the overlay. Undefined when nothing is due.
   */
  nextChangeAtMs(nowMs: number): number | undefined {
    const live = this.live(nowMs);
    if (live.length > 0) return Math.min(...live.map((fight) => fight.lastDamageAtMs + IDLE_GAP_MS));
    const shown = this.lastFinished();
    if (!shown) return undefined;
    const closesAtMs = finishedAt(shown) + SHOW_FINISHED_MS;
    return closesAtMs > nowMs ? closesAtMs : undefined;
  }

  /** Every fight on record, newest first, the ones in progress included. */
  reports(nowMs: number): BossFightReport[] {
    const current = [...this.open.values()].map((fight) => this.report(fight, nowMs));
    return [...current, ...this.finished].sort((left, right) => right.startedAtMs - left.startedAtMs);
  }

  /** The bosses being fought: hit lately and not yet dead, in the order first hit. */
  private live(nowMs: number): Fight[] {
    return [...this.open.values()]
      .filter((fight) => !this.ended(fight, nowMs))
      .sort((left, right) => left.startedAtMs - right.startedAtMs);
  }

  /** The fight that ended last, put away or not. */
  private lastFinished(): Fight | undefined {
    return [...this.open.values(), ...(this.latest ? [this.latest] : [])]
      .sort((left, right) => finishedAt(right) - finishedAt(left))[0];
  }

  private player(players: Map<string, PlayerTally>, name: string): PlayerTally {
    let tally = players.get(name);
    if (!tally) {
      tally = { name, damage: 0, hits: 0, crits: 0, deaths: 0, skills: new Map() };
      players.set(name, tally);
    }
    return tally;
  }

  /** Puts away fights that are over, once a dead boss's loot has had time to land. */
  private putAwayFinished(nowMs: number): void {
    for (const fight of [...this.open.values()]) {
      if (!this.ended(fight, nowMs)) continue;
      if (fight.diedAtMs !== undefined && nowMs - fight.diedAtMs <= DROP_WINDOW_MS) continue;
      this.archive(fight, nowMs);
    }
  }

  private archive(fight: Fight, nowMs: number): void {
    this.open.delete(fight.objectId);
    this.finished.push({ ...this.report(fight, nowMs), active: false });
    this.finished.sort((left, right) => left.startedAtMs - right.startedAtMs);
    if (this.finished.length > MAX_KEPT_FIGHTS) this.finished.splice(0, this.finished.length - MAX_KEPT_FIGHTS);
    if (!this.latest || fight.lastDamageAtMs >= this.latest.lastDamageAtMs) this.latest = fight;
  }

  private report(fight: Fight, nowMs: number): BossFightReport {
    return {
      id: fight.id,
      bossNames: [fight.name],
      ...(fight.mapName === undefined ? {} : { mapName: fight.mapName }),
      startedAtMs: fight.startedAtMs,
      durationMs: fight.lastDamageAtMs - fight.startedAtMs,
      totalDamage: fight.totalDamage,
      active: !this.ended(fight, nowMs),
      defeated: fight.diedAtMs !== undefined,
      players: reportPlayers(fight.players),
      drops: [...fight.drops.values()]
        .sort((left, right) => (right.rarity ?? 0) - (left.rarity ?? 0) || left.name.localeCompare(right.name))
        .map((drop) => ({ ...drop })),
    };
  }

  private ended(fight: Fight, nowMs: number): boolean {
    return fight.diedAtMs !== undefined || nowMs - fight.lastDamageAtMs >= IDLE_GAP_MS;
  }
}

/** When a fight ended: its boss's death, or the moment it went quiet. */
function finishedAt(fight: Fight): number {
  return fight.diedAtMs ?? fight.lastDamageAtMs + IDLE_GAP_MS;
}

function fightState(fight: Fight, active: boolean): BossFightState {
  return {
    bossNames: [fight.name],
    totalDamage: fight.totalDamage,
    durationMs: fight.lastDamageAtMs - fight.startedAtMs,
    active,
    rows: meterRows(fight.players),
  };
}

/** Two bosses of one name fought at once are told apart as "Kraken" and "Kraken 2". */
function numberedNames(fights: readonly Fight[]): string[] {
  const seen = new Map<string, number>();
  return fights.map((fight) => {
    const count = (seen.get(fight.name) ?? 0) + 1;
    seen.set(fight.name, count);
    return count === 1 ? fight.name : `${fight.name} ${count}`;
  });
}

function meterRows(players: Map<string, PlayerTally>): BossFightRow[] {
  return [...players.values()]
    .filter((player) => player.damage > 0)
    .sort((left, right) => right.damage - left.damage || left.name.localeCompare(right.name))
    .slice(0, MAX_ROWS)
    .map((player) => ({
      name: player.name,
      ...(player.archetype === undefined ? {} : { archetype: player.archetype }),
      damage: player.damage,
    }));
}

/** Players ranked by damage. */
function reportPlayers(players: Map<string, PlayerTally>): BossFightPlayer[] {
  return [...players.values()]
    .sort((left, right) => right.damage - left.damage || left.name.localeCompare(right.name))
    .map((player) => ({
      name: player.name,
      ...(player.archetype === undefined ? {} : { archetype: player.archetype }),
      damage: player.damage,
      hits: player.hits,
      crits: player.crits,
      deaths: player.deaths,
      skills: [...player.skills.values()].sort((left, right) => right.damage - left.damage).map((skill) => ({ ...skill })),
    }));
}
