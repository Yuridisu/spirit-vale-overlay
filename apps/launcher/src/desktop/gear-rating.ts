import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";
import { resolveFishNetItemDisplayName } from "@kar-mi/spirit-vale-tools-items";
import { maxSubstats, snapshot as plannerSnapshot } from "@svoverlay/build-export";
import type { OverlayGearRating, OverlayGearRatingState } from "@svoverlay/overlay/app-types";

const EQUIPMENT_ITEM_TYPE = 2;
export const MAX_GEAR_STARS = 6;

/** The game's equipment screen, read as two columns of five slots, top to bottom. */
const SCREEN_LAYOUT = [
  ["Head", "Eyewear"],
  ["Back", "Chest"],
  ["Main hand", "Off hand"],
  ["Legs", "Feet"],
  ["Left accessory", "Right accessory"],
] as const;

/**
 * Rates each equipped item's rolled substats out of six stars.
 *
 * Every substat line an item could carry is worth an equal share of the six stars. A line the item
 * has earns half of its share for being there and the other half in proportion to its roll, so an
 * item with every line at a perfect roll is six stars, the same lines at the lowest roll are three,
 * and a missing line earns nothing. Rounded to the nearest half star.
 */
export function rateGear(snapshot: CharacterSnapshot | undefined): OverlayGearRatingState {
  const equipped = new Map((snapshot?.equipment ?? []).map((item) => [item.slot, item]));
  return {
    slots: SCREEN_LAYOUT.flat().map((slot): OverlayGearRating | null => {
      const item = equipped.get(slot);
      if (!item) return null;
      const maxLines = maxSubstats(plannerSnapshot.equipment[item.itemId]);
      const lines = item.substats.slice(0, maxLines);
      const earned = lines.reduce((sum, line) => sum + 0.5 + Math.min(100, Math.max(0, line.roll)) / 200, 0);
      return {
        slot,
        name: resolveFishNetItemDisplayName(EQUIPMENT_ITEM_TYPE, item.itemId) ?? item.itemId,
        stars: Math.round(earned / maxLines * MAX_GEAR_STARS * 2) / 2,
        lines: lines.length,
        maxLines,
      };
    }),
  };
}
