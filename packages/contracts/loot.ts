/**
 * Drops shown on the radar and in loot notifications whatever the rarity and drop-chance filters
 * say. The server sends Box of Mastery below Epic, so an Epic-only filter would hide it.
 */
const ALWAYS_SHOWN_LOOT: ReadonlySet<string> = new Set(["box of mastery"]);

export function isAlwaysShownLoot(displayName: string | undefined): boolean {
  return displayName !== undefined && ALWAYS_SHOWN_LOOT.has(displayName.trim().toLowerCase());
}
