import { resolveFishNetItemDisplayName } from "@kar-mi/spirit-vale-tools-items";
import type { PickedUpEquipment } from "@kar-mi/spirit-vale-tools-rewards";
import { scaleRoll, snapshot } from "@svoverlay/build-export";
import type { OverlayGearPickupEvent } from "@svoverlay/overlay/app-types";

const EQUIPMENT_ITEM_TYPE = 2;

/**
 * Turns a picked-up equipment instance into the card the overlay shows: its name, slot, refine, and
 * each rolled substat scaled to the value the game displays. A stat the planner catalog has no
 * range for keeps its roll and simply shows no value.
 */
export function describeGearPickup(equipment: PickedUpEquipment): OverlayGearPickupEvent {
  const item = snapshot.equipment[equipment.itemId];
  return {
    itemId: equipment.itemId,
    displayName: resolveFishNetItemDisplayName(EQUIPMENT_ITEM_TYPE, equipment.itemId) ?? equipment.itemId,
    ...(item?.slot === undefined ? {} : { slot: item.slot }),
    refine: equipment.refine,
    stats: equipment.substats.map((substat) => {
      const statName = snapshot.statTypes[substat.type];
      const value = statName === undefined
        ? null
        : scaleRoll(snapshot, item, statName, substat.qualifier ?? "", substat.roll);
      return {
        label: statLabel(statName, substat.type),
        roll: substat.roll,
        ...(value === null ? {} : { value }),
        ...(substat.qualifier === undefined ? {} : { qualifier: substat.qualifier }),
      };
    }),
  };
}

/** `HpMult` reads as `Hp %` and `PerfectDodge` as `Perfect Dodge`, the way the game labels them. */
function statLabel(statName: string | undefined, type: number): string {
  if (statName === undefined) return `Stat ${type}`;
  const multiplier = statName.endsWith("Mult");
  const words = (multiplier ? statName.slice(0, -"Mult".length) : statName)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return multiplier ? `${words} %` : words;
}
