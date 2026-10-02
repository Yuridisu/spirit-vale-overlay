/** How many items the counter can follow at once. */
export const ITEM_COUNTER_SLOTS = 8;
const MAX_ITEM_NAME_LENGTH = 60;

export interface ItemCounterRow {
  name: string;
  count: number;
  /** Picked up since the app started. */
  gained: number;
}

/** Every stackable item the player is known to carry. */
export interface ItemCounterSource {
  /** False until the game has reported the bag, when the counts are only what was seen picked up. */
  known: boolean;
  items: ItemCounterRow[];
}

/** The items the player chose to follow, in slot order. */
export interface OverlayItemCounterState {
  known: boolean;
  rows: ItemCounterRow[];
}

/** One name per slot, in slot order; an empty string is a slot left free. */
export function normalizeItemCounterItems(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: ITEM_COUNTER_SLOTS }, (_unused, index) => {
    const name = source[index];
    return typeof name === "string" ? name.trim().slice(0, MAX_ITEM_NAME_LENGTH) : "";
  });
}

/**
 * Picks the followed items out of the bag. Names match whatever their case, and a followed item
 * the player does not carry still gets its row, at zero, so the slot never disappears mid-hunt.
 */
export function itemCounterState(followed: readonly string[], source: ItemCounterSource): OverlayItemCounterState {
  const byName = new Map(source.items.map((item) => [item.name.toLowerCase(), item]));
  const seen = new Set<string>();
  const rows: ItemCounterRow[] = [];
  for (const name of followed) {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(byName.get(key) ?? { name: name.trim(), count: 0, gained: 0 });
  }
  return { known: source.known, rows };
}
