/** How many drops the player can be watching for at once. */
export const TARGET_DROP_SLOTS = 4;
/** How many stats one target can ask for. */
export const TARGET_DROP_STATS = 4;
/** The sound a target plays unless another is chosen: one of the Companion's built-in tones. */
export const DEFAULT_TARGET_DROP_SOUND = "alert";
const MAX_NAME_LENGTH = 60;
const MAX_STAT_VALUE = 100_000;

/** Equipment slots other than weapons, as the item catalog names them. */
export const ARMOR_SLOTS = ["Head", "Eyewear", "Chest", "Back", "Legs", "Feet", "Accessory", "Shield"] as const;
/** Weapon kinds, which the item catalog gives as the slot of a weapon. */
export const WEAPON_SLOTS = [
  "Dagger", "Sword", "Axe", "Mace", "Spear", "Scythe", "Twinblade", "Katar",
  "Bow", "Wand", "Book", "Pistol", "Rifle", "Shotgun", "GatlingGun", "Launcher",
] as const;
/** The four pieces of an artifact set. */
export const ARTIFACT_PIECES = ["Rune", "Jewel", "Scroll", "Relic"] as const;

export type TargetDropTypeGroup = "generic" | "armor" | "weapon" | "artifact";

/**
 * What a target can be narrowed to besides its name: anything, any equipment, any weapon, any
 * artifact, or one slot or artifact piece.
 */
export const TARGET_DROP_TYPES: ReadonlyArray<{ id: string; group: TargetDropTypeGroup }> = [
  ...["any", "equipment", "weapon", "artifact"].map((id) => ({ id, group: "generic" as const })),
  ...ARMOR_SLOTS.map((id) => ({ id, group: "armor" as const })),
  ...WEAPON_SLOTS.map((id) => ({ id, group: "weapon" as const })),
  ...ARTIFACT_PIECES.map((id) => ({ id, group: "artifact" as const })),
];

export interface TargetDropStat {
  /** The stat as the pickup card labels it, e.g. `Int` or `Matk %`; empty is an unused row. */
  stat: string;
  /** The least the item must have of it. Zero asks only that the stat be there. */
  min: number;
}

export interface TargetDrop {
  /** Words the item's name must contain, e.g. `starfire jewel`; may be empty when a type is chosen. */
  name: string;
  /** One of `TARGET_DROP_TYPES`; `any` with no name is an unused slot. */
  type: string;
  /** The alert sound by name: a built-in tone or one of the player's `.wav` files. */
  sound: string;
  stats: TargetDropStat[];
}

/** What a picked-up item offers to be matched against. */
export interface TargetDropCandidate {
  displayName: string;
  /** Equipment and artifacts carry rolls and a slot; everything else is a plain item. */
  kind?: "equipment" | "artifact" | "item";
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
      type: targetDropType(target.type),
      sound: text(target.sound) || DEFAULT_TARGET_DROP_SOUND,
      stats: Array.from({ length: TARGET_DROP_STATS }, (_row, index) => {
        const row = isRecord(stats[index]) ? stats[index] : {};
        const min = typeof row.min === "number" && Number.isFinite(row.min) ? row.min : 0;
        return { stat: text(row.stat), min: Math.max(0, Math.min(MAX_STAT_VALUE, min)) };
      }),
    };
  });
}

/** Whether a slot describes a drop at all: it has a name, or a type narrower than anything. */
export function isTargetDropUsed(target: TargetDrop): boolean {
  return target.name !== "" || target.type !== "any";
}

/**
 * The first target the item satisfies, as its slot index, or undefined.
 *
 * The item must be of the target's type. Every word of the target's name must appear in the item's
 * name or slot, whatever the case, so `starfire jewel` finds the Jewel of the Starfire set. Every
 * stat asked for must be on the item at the asked value or better; a stat whose value the overlay
 * cannot work out only satisfies a target that asks for no minimum.
 */
export function matchTargetDrop(targets: readonly TargetDrop[], candidate: TargetDropCandidate): number | undefined {
  const haystack = `${candidate.displayName} ${candidate.slot ?? ""}`.toLowerCase();
  const index = targets.findIndex((target) => {
    if (!isTargetDropUsed(target) || !matchesType(target.type, candidate)) return false;
    const words = target.name.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.every((word) => haystack.includes(word))) return false;
    return target.stats.every((wanted) => {
      const key = statKey(wanted.stat);
      if (!key) return true;
      return candidate.stats.some((stat) => statKey(stat.label) === key
        && (wanted.min <= 0 || (stat.value !== undefined && Math.abs(stat.value) >= wanted.min)));
    });
  });
  return index < 0 ? undefined : index;
}

function matchesType(type: string, candidate: TargetDropCandidate): boolean {
  const slot = candidate.slot?.toLowerCase();
  switch (type) {
    case "any": return true;
    case "equipment": return candidate.kind === "equipment";
    case "weapon": return candidate.kind === "equipment" && WEAPON_SLOTS.some((weapon) => weapon.toLowerCase() === slot);
    case "artifact": return candidate.kind === "artifact";
    default: return candidate.kind !== "item" && slot === type.toLowerCase();
  }
}

/** `MATK %`, `matk%` and `Matk %` are one stat; `Matk` without the sign is another. */
export function statKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "");
}

function targetDropType(value: unknown): string {
  const wanted = typeof value === "string" ? value.toLowerCase() : "";
  return TARGET_DROP_TYPES.find((type) => type.id.toLowerCase() === wanted)?.id ?? "any";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_NAME_LENGTH) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
