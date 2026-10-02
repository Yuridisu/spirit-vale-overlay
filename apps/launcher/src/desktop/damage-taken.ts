export interface DamageTakenRow {
  /** The skill or attack that hit, as the game names it. */
  label: string;
  /** The monster that used it, when it is known. */
  attacker?: string;
  damage: number;
  hits: number;
}

/** The hit that killed the player. */
export interface DamageTakenDeath {
  label: string;
  attacker?: string;
  damage: number;
  /** Wall-clock time of the death, in milliseconds. */
  atMs: number;
}

export interface DamageTakenState {
  total: number;
  rows: DamageTakenRow[];
  /** The player's last death, kept on show until the next one. */
  killedBy?: DamageTakenDeath;
}

/** Hits this long apart belong to two different fights. */
const IDLE_GAP_MS = 60_000;
const MAX_ROWS = 12;

/**
 * Adds up what hits the local player, by who hit and with what.
 *
 * It keeps its own time rather than the damage meter's encounter, which only exists while the
 * player is dealing damage: someone standing still and being hit is exactly who wants this.
 */
export class DamageTakenTracker {
  private readonly rows = new Map<string, DamageTakenRow>();
  private total = 0;
  private lastHitAtMs: number | undefined;
  private killedBy: DamageTakenDeath | undefined;

  observe(hit: { label: string; attacker?: string; damage: number }, nowMs: number): void {
    if (!Number.isFinite(hit.damage) || hit.damage <= 0) return;
    if (this.lastHitAtMs !== undefined && nowMs - this.lastHitAtMs >= IDLE_GAP_MS) this.reset();
    this.lastHitAtMs = nowMs;
    this.total += hit.damage;
    const key = `${hit.attacker ?? ""}\u0000${hit.label}`;
    const row = this.rows.get(key) ?? {
      label: hit.label,
      ...(hit.attacker === undefined ? {} : { attacker: hit.attacker }),
      damage: 0,
      hits: 0,
    };
    row.damage += hit.damage;
    row.hits += 1;
    this.rows.set(key, row);
  }

  /**
   * Remembers the killing blow. It outlives the tally: dying sends the player back to town, and the
   * map change and the quiet that follow would otherwise clear the answer before it was read.
   */
  observeDeath(hit: { label: string; attacker?: string; damage: number }, atMs: number): void {
    this.killedBy = {
      label: hit.label,
      ...(hit.attacker === undefined ? {} : { attacker: hit.attacker }),
      damage: Number.isFinite(hit.damage) ? Math.max(0, hit.damage) : 0,
      atMs,
    };
  }

  reset(): void {
    this.rows.clear();
    this.total = 0;
    this.lastHitAtMs = undefined;
  }

  state(): DamageTakenState {
    return {
      total: this.total,
      rows: [...this.rows.values()]
        .sort((left, right) => right.damage - left.damage || left.label.localeCompare(right.label))
        .slice(0, MAX_ROWS)
        .map((row) => ({ ...row })),
      ...(this.killedBy === undefined ? {} : { killedBy: { ...this.killedBy } }),
    };
  }
}
