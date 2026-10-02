import { resolveFishNetItemDisplayName } from "@kar-mi/spirit-vale-tools-items";
import type { PickedUpArtifact, PickedUpEquipment, PickedUpSubstat } from "@kar-mi/spirit-vale-tools-rewards";
import { ARTIFACT_ITEM, scaleRoll, snapshot } from "@svoverlay/build-export";
import type { SnapshotEquipment } from "@svoverlay/build-export";
import type { OverlayGearPickupEvent, OverlayGearPickupStat } from "@svoverlay/overlay/app-types";

const EQUIPMENT_ITEM_TYPE = 2;
const ARTIFACT_ITEM_TYPE = 3;
const ARTIFACT_SLOTS = ["Rune", "Jewel", "Scroll", "Relic"];

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
    stats: equipment.substats.map((substat) => describeSubstat(substat, item)),
  };
}

/** The artifact counterpart: the set's name, which of the four pieces it is, and its rolls. */
export function describeArtifactPickup(artifact: PickedUpArtifact): OverlayGearPickupEvent {
  const slot = ARTIFACT_SLOTS[artifact.slot];
  return {
    itemId: artifact.itemId,
    displayName: resolveFishNetItemDisplayName(ARTIFACT_ITEM_TYPE, artifact.itemId) ?? artifact.itemId,
    ...(slot === undefined ? {} : { slot }),
    refine: artifact.refine,
    stats: artifact.substats.map((substat) => describeSubstat(substat, ARTIFACT_ITEM)),
  };
}

/** Every stat a pickup card can label, for choosing among when describing a wanted drop. */
export function pickupStatLabels(): string[] {
  const labels = new Set(Object.entries(snapshot.statTypes).map(([type, name]) => statLabel(name, Number(type))));
  return [...labels].sort((left, right) => left.localeCompare(right));
}

function describeSubstat(substat: PickedUpSubstat, item: SnapshotEquipment | undefined): OverlayGearPickupStat {
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
}

/** `HpMult` reads as `Hp %` and `PerfectDodge` as `Perfect Dodge`, the way the game labels them. */
function statLabel(statName: string | undefined, type: number): string {
  if (statName === undefined) return `Stat ${type}`;
  const multiplier = statName.endsWith("Mult");
  const words = (multiplier ? statName.slice(0, -"Mult".length) : statName)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return multiplier ? `${words} %` : words;
}
