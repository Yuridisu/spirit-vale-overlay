import { describe, expect, test } from "bun:test";
import type { FishNetLootDrop } from "@kar-mi/spirit-vale-tools-rewards";

import { PickedUpDrops, dropKey } from "./picked-up-drops.ts";

const drop = (objectId: number, displayName: string, position: [number, number, number]): FishNetLootDrop =>
  ({ objectId, tick: 1, displayName, position } as FishNetLootDrop);
const self = { x: 0, y: 0, z: 0 };

describe("PickedUpDrops", () => {
  test("a pickup whose drop never despawns forgets the nearest drop of that item, after the grace", () => {
    const drops = new PickedUpDrops(3_000);
    const ground = [drop(1, "Direwolf Card", [30, 0, 0]), drop(2, "Direwolf Card", [2, 0, 0]), drop(3, "Marble", [1, 0, 0])];
    drops.notePickup(["Direwolf Card"], 0);
    expect(drops.due(1_000, ground, self)).toEqual([]);
    expect(drops.due(3_000, ground, self)).toEqual([2]);
    expect(drops.hasPending()).toBe(false);
  });

  test("a pickup whose drop despawned, before or after it, forgets nothing else", () => {
    const ground = [drop(9, "Trick or Treat Bag", [1, 0, 0])];
    const before = new PickedUpDrops(3_000);
    before.noteRemoved(drop(8, "Trick or Treat Bag", [0, 0, 0]), 0);
    before.notePickup(["Trick or Treat Bag"], 200);
    expect(before.due(4_000, ground, self)).toEqual([]);

    const after = new PickedUpDrops(3_000);
    after.notePickup(["Trick or Treat Bag"], 0);
    after.noteRemoved(drop(8, "Trick or Treat Bag", [0, 0, 0]), 1_500);
    expect(after.due(3_500, ground, self)).toEqual([]);
  });

  test("two pickups of one item take two drops; refine and case do not matter", () => {
    const drops = new PickedUpDrops(1_000);
    drops.notePickup(["Doom Keg", "Doom Keg"], 0);
    expect(drops.due(1_000, [drop(1, "+7 Frenzy Doom Keg", [5, 0, 0]), drop(2, "doom keg", [1, 0, 0])], self).sort()).toEqual([1, 2]);
    expect(dropKey("+9 Speed Gauntlets")).toBe("speed gauntlets");
  });

  test("an artifact picked up matches its drop, which is named for its slot", () => {
    const drops = new PickedUpDrops(1_000);
    drops.notePickup(["Blitzcore"], 0, { artifacts: true });
    expect(drops.due(1_000, [drop(1, "Blitzcore Jewel", [2, 0, 0]), drop(2, "Spider Web", [0, 0, 0])], self)).toEqual([1]);
    // Only artifacts: an item called "Blitzcore" would not take a "Blitzcore Jewel" drop.
    const items = new PickedUpDrops(1_000);
    items.notePickup(["Blitzcore"], 0);
    expect(items.due(1_000, [drop(1, "Blitzcore Jewel", [2, 0, 0])], self)).toEqual([]);
  });

  test("a pickup with no matching drop on the ground is dropped quietly", () => {
    const drops = new PickedUpDrops(1_000);
    drops.notePickup(["Starfire Relic"], 0);
    expect(drops.due(2_000, [drop(1, "Marble", [0, 0, 0])], self)).toEqual([]);
    expect(drops.hasPending()).toBe(false);
  });
});
