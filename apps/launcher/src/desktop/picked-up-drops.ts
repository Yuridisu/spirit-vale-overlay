import type { FishNetLootDrop } from "@kar-mi/spirit-vale-tools-rewards";

/** How long a pickup and a despawn of the same item may be apart and still be the same pickup. */
export const PICKUP_GRACE_MS = 3_000;

interface Pending { key: string; atMs: number; artifact?: boolean }

/** An artifact drops named for its slot ("Blitzcore Jewel") while the pickup names only the artifact ("Blitzcore"). */
const ARTIFACT_SLOT = / (rune|jewel|scroll|relic)$/;

/**
 * Finds the ground drops a pickup took when the game never despawns them. Items a pet picks up
 * (and some others) reach the bag through PickupItems_T while their drop object is never
 * despawned, so they stayed on the minimap. A pickup whose drop does despawn within the grace
 * period is left alone; otherwise the matching drop nearest the player is forgotten.
 */
export class PickedUpDrops {
  private pickups: Pending[] = [];
  private removals: Pending[] = [];

  constructor(private readonly graceMs = PICKUP_GRACE_MS) {}

  /** A drop the game despawned (its own pickup, expiry, or leaving view). */
  noteRemoved(drop: FishNetLootDrop, nowMs: number): void {
    if (drop.displayName) this.removals.push({ key: dropKey(drop.displayName), atMs: nowMs });
  }

  /** Items that just entered the bag, by display name; artifacts match a drop named for their slot too. */
  notePickup(names: readonly string[], nowMs: number, options: { artifacts?: boolean } = {}): void {
    for (const name of names) {
      if (name.trim()) this.pickups.push({ key: dropKey(name), atMs: nowMs, ...(options.artifacts ? { artifact: true } : {}) });
    }
  }

  /** The object ids of drops to forget now, out of those still believed to be on the ground. */
  due(nowMs: number, active: readonly FishNetLootDrop[], self?: { x: number; y: number; z: number }): number[] {
    const forget: number[] = [];
    const left = active.filter((drop) => drop.displayName);
    const waiting: Pending[] = [];
    for (const pickup of this.pickups) {
      if (nowMs - pickup.atMs < this.graceMs) { waiting.push(pickup); continue; }
      const despawned = this.removals.findIndex((removal) => matches(removal.key, pickup) && Math.abs(removal.atMs - pickup.atMs) <= this.graceMs);
      if (despawned >= 0) { this.removals.splice(despawned, 1); continue; }
      const candidates = left.filter((drop) => matches(dropKey(drop.displayName!), pickup) && !forget.includes(drop.objectId));
      if (!candidates.length) continue;
      const nearest = candidates.reduce((best, drop) => (distance(drop, self) < distance(best, self) ? drop : best));
      forget.push(nearest.objectId);
    }
    this.pickups = waiting;
    this.removals = this.removals.filter((removal) => nowMs - removal.atMs <= this.graceMs * 2);
    return forget;
  }

  hasPending(): boolean { return this.pickups.length > 0; }

  reset(): void {
    this.pickups = [];
    this.removals = [];
  }
}

/** "+7 Frenzy Doom Keg" and "Doom Keg" name one item; case and refine do not matter. */
export function dropKey(name: string): string {
  return name.trim().toLowerCase().replace(/^\+\d+\s+/, "").replace(/\s+/g, " ");
}

function sameItem(a: string, b: string): boolean {
  return a === b || a.endsWith(` ${b}`) || b.endsWith(` ${a}`);
}

function matches(dropName: string, pickup: Pending): boolean {
  return sameItem(dropName, pickup.key) || (pickup.artifact === true && sameItem(dropName.replace(ARTIFACT_SLOT, ""), pickup.key));
}

function distance(drop: FishNetLootDrop, self: { x: number; y: number; z: number } | undefined): number {
  if (!self || !drop.position) return Number.POSITIVE_INFINITY;
  const [x, y, z] = drop.position;
  return Math.hypot(x - self.x, y - self.y, z - self.z);
}
