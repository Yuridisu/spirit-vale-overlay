import type { BossHealth } from "@svoverlay/contracts/dark-fortress";
import {
  ECHOING_SPIRE_FLOORS,
  ECHOING_SPIRE_LEVEL_OFFSET,
  type EchoingSpireFloor,
  type EchoingSpireRun,
  type EchoingSpireRunSummary,
  type EchoingSpireState,
} from "@svoverlay/contracts/echoing-spire";

/** Out of the Spire for longer than this, the run is over; back sooner (a reconnect), it carries on. */
export const SPIRE_RUN_GRACE_MS = 60_000;
/** Runs kept on record, the one in progress included. */
export const MAX_SPIRE_RUNS = 20;
const MAX_HISTORY = 5;
/** Monsters of one level it takes to call the next floor (or two); a boss's level alone is enough. */
const NEXT_FLOOR_VOTES = 3;
/** Monsters of one level it takes to call a floor far from the last one (a climb resumed, a floor missed). */
const FAR_FLOOR_VOTES = 10;

interface Boss {
  name: string;
  firstHitAtMs?: number;
  diedAtMs?: number;
  damage: number;
}

export interface SpireMark {
  selfCursed: boolean;
  marked: boolean;
  markExpiresAtMs?: number;
}

/**
 * The climb through the Echoing Spire: the run, each floor's time, kills and gains, the bosses on the
 * floor the player is on, and the Umbral curse in sight. The game sends no floor number; a floor's
 * monsters are its number plus 100 in level (a boss floor's boss too), which is what floors follow.
 */
export class EchoingSpireTracker {
  private inSpire = false;
  private run?: EchoingSpireRun;
  /** Finished runs, newest first. */
  private past: EchoingSpireRun[] = [];
  /** Monsters already counted dead on this floor: the killing blow and the death both name them. */
  private readonly dead = new Set<number>();
  private readonly bosses = new Map<number, Boss>();
  private readonly manifestations = new Set<number>();
  /** Other players the Umbral Curse was put on; whether it is still on them is asked when drawn. */
  private readonly cursed = new Set<number>();
  /** Monsters seen at each candidate floor above the current one, and when the first of them was. */
  private readonly floorVotes = new Map<number, { votes: number; firstAtMs: number }>();
  private area: number | undefined;
  private revisionValue = 0;

  /** Bumped whenever the record of runs changes: a floor, a kill, a boss down, a run over. */
  get revision(): number {
    return this.revisionValue;
  }

  get active(): boolean {
    return this.inSpire;
  }

  /** The tower state the capture reads. Returns whether anything changed. */
  noteTower(inTower: boolean, floor: number | undefined, nowMs: number): boolean {
    if (!inTower) {
      if (!this.inSpire) return false;
      this.inSpire = false;
      this.area = undefined;
      if (this.run) this.run.leftAtMs = nowMs;
      this.clearFloor();
      this.touch();
      return true;
    }
    let changed = !this.inSpire;
    this.inSpire = true;
    const run = this.run;
    const current = run?.floors.at(-1);
    const expired = run?.leftAtMs !== undefined && nowMs - run.leftAtMs > SPIRE_RUN_GRACE_MS;
    // A lower floor than the one the run was on is a fresh climb.
    const restarted = floor !== undefined && current !== undefined && floor < current.floor;
    if (!run || expired || restarted) {
      if (run) this.archive(run, nowMs);
      this.run = { startedAtMs: nowMs, floors: [], kills: 0, experience: 0, coins: 0 };
      this.clearFloor();
      changed = true;
    } else if (run.leftAtMs !== undefined) {
      delete run.leftAtMs;
    }
    if (floor !== undefined && floor !== this.run!.floors.at(-1)?.floor) {
      const previous = this.run!.floors.at(-1);
      if (previous && previous.endedAtMs === undefined) previous.endedAtMs = nowMs;
      this.run!.floors.push({ floor, startedAtMs: nowMs, kills: 0, experience: 0, coins: 0, bosses: [] });
      this.clearFloor();
      changed = true;
    }
    if (changed) this.touch();
    return changed;
  }

  /**
   * A monster in sight on the Spire, by its level: the floor is that level less 100. Leftovers and a
   * boss floor's helpers are below the floor already reached, so they never move it; a floor above
   * it needs a few monsters of that level, or the floor's boss.
   */
  noteMonsterLevel(level: number, boss: boolean, nowMs: number): boolean {
    if (!this.inSpire) return false;
    const floor = level - ECHOING_SPIRE_LEVEL_OFFSET;
    if (!Number.isInteger(floor) || floor < 1 || floor > ECHOING_SPIRE_FLOORS) return false;
    const current = this.currentFloor()?.floor;
    if (current !== undefined && floor <= current) return false;
    const seen = this.floorVotes.get(floor) ?? { votes: 0, firstAtMs: nowMs };
    seen.votes += 1;
    this.floorVotes.set(floor, seen);
    const near = current === undefined || floor - current <= 2;
    if (!boss && seen.votes < (near ? NEXT_FLOOR_VOTES : FAR_FLOOR_VOTES)) return false;
    if (boss && !near && seen.votes < NEXT_FLOOR_VOTES) return false;
    // The floor began with the first of its monsters.
    return this.noteTower(true, floor, seen.firstAtMs);
  }

  /**
   * The Spire map the player is on (its floors and its boss floors are separate maps). Moving from
   * one to the other leaves what was in sight behind, even before the floor is known.
   */
  noteArea(area: number | undefined): boolean {
    if (!this.inSpire || area === undefined || area === this.area) return false;
    const moved = this.area !== undefined;
    this.area = area;
    if (!moved) return false;
    this.clearFloor();
    return true;
  }

  /** A monster died in sight. Returns whether anything changed. */
  noteKill(objectId: number, nowMs: number): boolean {
    this.manifestations.delete(objectId);
    const boss = this.bosses.get(objectId);
    if (boss && boss.diedAtMs === undefined) {
      boss.diedAtMs = nowMs;
      this.currentFloor()?.bosses.push({
        name: boss.name,
        damage: boss.damage,
        ...(boss.firstHitAtMs === undefined ? {} : { fightMs: nowMs - boss.firstHitAtMs }),
      });
      this.touch();
    }
    const floor = this.currentFloor();
    if (!this.inSpire || !this.run || this.dead.has(objectId)) return boss !== undefined;
    this.dead.add(objectId);
    this.run.kills += 1;
    if (floor) floor.kills += 1;
    this.touch();
    return true;
  }

  /** What a kill paid the player. */
  noteRewards(experience: number, coins: number): boolean {
    if (!this.inSpire || !this.run || (experience === 0 && coins === 0)) return false;
    this.run.experience += experience;
    this.run.coins += coins;
    const floor = this.currentFloor();
    if (floor) {
      floor.experience += experience;
      floor.coins += coins;
    }
    this.touch();
    return true;
  }

  /** A boss in sight on this floor, or hit (for that much). Returns whether anything changed. */
  noteBoss(objectId: number, name: string, nowMs: number, hit: boolean, damage = 0): boolean {
    if (!this.inSpire || this.dead.has(objectId)) return false;
    const boss = this.bosses.get(objectId);
    if (!boss) {
      this.bosses.set(objectId, { name, damage: hit ? damage : 0, ...(hit ? { firstHitAtMs: nowMs } : {}) });
      return true;
    }
    if (hit) boss.damage += damage;
    if (hit && boss.firstHitAtMs === undefined) {
      boss.firstHitAtMs = nowMs;
      return true;
    }
    return false;
  }

  isBoss(objectId: number): boolean {
    return this.bosses.has(objectId);
  }

  /** A Curse Manifestation came into sight or left it. */
  noteManifestation(objectId: number, present: boolean): boolean {
    if (!this.inSpire && present) return false;
    if (present && this.dead.has(objectId)) return false;
    return present ? add(this.manifestations, objectId) : this.manifestations.delete(objectId);
  }

  /** Another player took on the Umbral Curse, or lost it. */
  noteCursed(objectId: number, cursed: boolean): boolean {
    if (!this.inSpire && cursed) return false;
    return cursed ? add(this.cursed, objectId) : this.cursed.delete(objectId);
  }

  /** An object left sight. */
  forget(objectId: number): boolean {
    const manifestation = this.manifestations.delete(objectId);
    const cursed = this.cursed.delete(objectId);
    return manifestation || cursed;
  }

  /** Every run on record, newest first: the one in progress, then the finished ones. */
  runs(): EchoingSpireRun[] {
    return [...(this.run && this.run.floors.length > 0 ? [this.run] : []), ...this.past].map(cloneRun);
  }

  /** Finished runs of earlier sessions, newest first. */
  restore(runs: readonly EchoingSpireRun[]): void {
    this.past = runs.slice(0, MAX_SPIRE_RUNS).map(cloneRun);
    this.touch();
  }

  state(
    healthOf: (objectId: number) => BossHealth | undefined = () => undefined,
    mark: SpireMark = { selfCursed: false, marked: false },
    stillCursed: (actorId: number) => boolean = () => true,
  ): EchoingSpireState {
    const floor = this.currentFloor()?.floor;
    return {
      inSpire: this.inSpire,
      ...(this.inSpire && floor !== undefined ? { floor } : {}),
      ...(this.run ? { run: cloneRun(this.run) } : {}),
      bosses: [...this.bosses].map(([objectId, boss]) => {
        const health = boss.diedAtMs === undefined ? healthOf(objectId) : undefined;
        return {
          name: boss.name,
          status: boss.diedAtMs === undefined ? "alive" as const : "dead" as const,
          ...(health ? { health } : {}),
          ...(boss.firstHitAtMs === undefined ? {} : { firstHitAtMs: boss.firstHitAtMs }),
          ...(boss.diedAtMs === undefined ? {} : { diedAtMs: boss.diedAtMs }),
        };
      }),
      curse: {
        manifestations: this.manifestations.size,
        cursedPlayers: this.inSpire ? [...this.cursed].filter(stillCursed).length : 0,
        selfCursed: this.inSpire && mark.selfCursed,
        marked: this.inSpire && mark.marked,
        ...(this.inSpire && mark.marked && mark.markExpiresAtMs !== undefined ? { markExpiresAtMs: mark.markExpiresAtMs } : {}),
      },
      history: this.past.slice(0, MAX_HISTORY).map(summarize),
    };
  }

  private currentFloor(): EchoingSpireFloor | undefined {
    return this.run?.floors.at(-1);
  }

  private touch(): void {
    this.revisionValue += 1;
  }

  private clearFloor(): void {
    this.dead.clear();
    this.bosses.clear();
    this.manifestations.clear();
    this.cursed.clear();
    this.floorVotes.clear();
  }

  private archive(run: EchoingSpireRun, nowMs: number): void {
    if (run.floors.length === 0) return;
    const endedAtMs = run.leftAtMs ?? nowMs;
    const last = run.floors.at(-1)!;
    if (last.endedAtMs === undefined) last.endedAtMs = endedAtMs;
    this.past.unshift({ ...cloneRun(run), endedAtMs });
    this.past.length = Math.min(this.past.length, MAX_SPIRE_RUNS - 1);
  }
}

function summarize(run: EchoingSpireRun): EchoingSpireRunSummary {
  const first = run.floors[0]?.floor;
  const last = run.floors.at(-1)?.floor;
  return {
    startedAtMs: run.startedAtMs,
    endedAtMs: run.endedAtMs ?? run.leftAtMs ?? run.floors.at(-1)?.endedAtMs ?? run.startedAtMs,
    ...(first === undefined ? {} : { firstFloor: first }),
    ...(last === undefined ? {} : { lastFloor: last }),
    kills: run.kills,
    experience: run.experience,
  };
}

function add(set: Set<number>, value: number): boolean {
  if (set.has(value)) return false;
  set.add(value);
  return true;
}

function cloneRun(run: EchoingSpireRun): EchoingSpireRun {
  return { ...run, floors: run.floors.map((floor) => ({ ...floor, bosses: floor.bosses.map((boss) => ({ ...boss })) })) };
}
