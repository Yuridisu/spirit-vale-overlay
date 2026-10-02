/** How many drops the player can be watching for at once. */
export const TARGET_DROP_SLOTS = 4;
/** How many stats one target can ask for. */
export const TARGET_DROP_STATS = 4;
const MAX_NAME_LENGTH = 60;
const MAX_STAT_VALUE = 100_000;

export interface TargetDropStat {
  /** The stat as the pickup card labels it, e.g. `Int` or `Matk %`; empty is an unused row. */
  stat: string;
  /** The least the item must have of it. Zero asks only that the stat be there. */
  min: number;
}

export interface TargetDrop {
  /** Words the item's name must contain, e.g. `starfire jewel`; empty is an unused slot. */
  name: string;
  stats: TargetDropStat[];
}

/** What a picked-up item offers to be matched against. */
export interface TargetDropCandidate {
  displayName: string;
  /** The equipment slot or artifact piece, which players name as part of the item. */
  slot?: string;
  stats: ReadonlyArray<{ label: string; value?: number }>;
}

/** Always `TARGET_DROP_SLOTS` targets of `TARGET_DROP_STATS` stat rows, so the editor has fixed rows to fill. */
export function normalizeTargetDrops(value: unknown): TargetDrop[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: TARGET_DROP_SLOTS }, (_unused, slot) => {
    const target = isRecord(source[slot]) ? source[slot] : {};
    const stats = Array.isArray(target.stats) ? target.stats : [];
    return {
      name: text(target.name),
      stats: Array.from({ length: TARGET_DROP_STATS }, (_row, index) => {
        const row = isRecord(stats[index]) ? stats[index] : {};
        const min = typeof row.min === "number" && Number.isFinite(row.min) ? row.min : 0;
        return { stat: text(row.stat), min: Math.max(0, Math.min(MAX_STAT_VALUE, min)) };
      }),
    };
  });
}

/**
 * The first target the item satisfies, as its slot index, or undefined.
 *
 * Every word of the target's name must appear in the item's name or slot, whatever the case, so
 * `starfire jewel` finds the Jewel of the Starfire set. Every stat asked for must be on the item
 * at the asked value or better; a stat whose value the overlay cannot work out only satisfies a
 * target that asks for no minimum.
 */
export function matchTargetDrop(targets: readonly TargetDrop[], candidate: TargetDropCandidate): number | undefined {
  const haystack = `${candidate.displayName} ${candidate.slot ?? ""}`.toLowerCase();
  const index = targets.findIndex((target) => {
    const words = target.name.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0 || !words.every((word) => haystack.includes(word))) return false;
    return target.stats.every((wanted) => {
      const key = statKey(wanted.stat);
      if (!key) return true;
      return candidate.stats.some((stat) => statKey(stat.label) === key
        && (wanted.min <= 0 || (stat.value !== undefined && Math.abs(stat.value) >= wanted.min)));
    });
  });
  return index < 0 ? undefined : index;
}

/** `MATK %`, `matk%` and `Matk %` are one stat; `Matk` without the sign is another. */
export function statKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
