export interface InventoryCountRow {
  name: string;
  /** How many are in the bag, or only what was picked up while the bag is still unknown. */
  count: number;
  /** Picked up since the app started. */
  gained: number;
}

export interface InventoryCountState {
  /** False until the game has reported the bag, when the counts are only what was seen picked up. */
  known: boolean;
  items: InventoryCountRow[];
}

/**
 * The game sends the bag again with each pickup, already counting it, and the pickup itself lands
 * just after. A pickup this soon after a bag report is taken to be in that report.
 */
const BAG_COVERS_PICKUP_MS = 2_000;

/**
 * Keeps a running count of the stackable items the player carries.
 *
 * The bag the game reports is the count. A pickup is only added on top of it when no report came
 * with it, which keeps the count moving should the game ever send a pickup on its own; the next
 * report replaces everything, and so also corrects for anything sold, used or stored.
 */
export class InventoryCounter {
  private readonly counts = new Map<string, number>();
  private readonly gained = new Map<string, number>();
  private known = false;
  private bagAtMs = Number.NEGATIVE_INFINITY;

  /** Replaces every count with the bag the game just reported. */
  setBag(items: ReadonlyArray<{ name: string; count: number }>, nowMs: number): void {
    this.bagAtMs = nowMs;
    this.counts.clear();
    for (const item of items) add(this.counts, item.name, item.count);
    this.known = true;
  }

  /** Returns whether anything was counted. */
  addPickup(items: ReadonlyArray<{ name: string; count: number }>, nowMs: number): boolean {
    const inBag = this.known && nowMs - this.bagAtMs < BAG_COVERS_PICKUP_MS;
    let changed = false;
    for (const item of items) {
      if (!Number.isFinite(item.count) || item.count <= 0) continue;
      if (!inBag) add(this.counts, item.name, item.count);
      add(this.gained, item.name, item.count);
      changed = true;
    }
    return changed;
  }

  /** Drops the bag, for a change of character. Returns whether there was one to drop. */
  forgetBag(): boolean {
    if (!this.known && this.counts.size === 0) return false;
    this.counts.clear();
    this.gained.clear();
    this.known = false;
    this.bagAtMs = Number.NEGATIVE_INFINITY;
    return true;
  }

  state(): InventoryCountState {
    const names = new Set([...this.counts.keys(), ...this.gained.keys()]);
    const items = [...names]
      .map((name) => ({ name, count: this.counts.get(name) ?? 0, gained: this.gained.get(name) ?? 0 }))
      .sort((left, right) => left.name.localeCompare(right.name));
    return { known: this.known, items };
  }
}

function add(totals: Map<string, number>, name: string, count: number): void {
  totals.set(name, (totals.get(name) ?? 0) + count);
}
