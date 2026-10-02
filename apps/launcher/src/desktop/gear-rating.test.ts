import { expect, test } from "bun:test";

import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";

import { rateGear } from "./gear-rating.ts";

function snapshot(equipment: Array<{ slot: string; itemId: string; rolls: number[] }>): CharacterSnapshot {
  return {
    equipment: equipment.map(({ slot, itemId, rolls }) => ({
      slot,
      itemId,
      refine: 0,
      cards: [],
      substats: rolls.map((roll, index) => ({ type: index, name: `Stat ${index}`, roll, percent: false })),
    })),
  } as unknown as CharacterSnapshot;
}

const ratings = (state: ReturnType<typeof rateGear>): Record<string, number> =>
  Object.fromEntries(state.slots.flatMap((slot) => (slot ? [[slot.slot, slot.stars]] : [])));

test("gives six stars only to an item with every line at a perfect roll", () => {
  // Artemis is a bow, so it can carry six lines; Arrowcatch Wall is a shield, which carries five.
  const state = rateGear(snapshot([
    { slot: "Main hand", itemId: "Artemis", rolls: [100, 100, 100, 100, 100, 100] },
    { slot: "Off hand", itemId: "Arrowcatch Wall", rolls: [100, 100, 100, 100, 100] },
  ]));
  expect(ratings(state)).toEqual({ "Main hand": 6, "Off hand": 6 });
});

test("counts a missing line as nothing and a present one as half before its roll", () => {
  const state = rateGear(snapshot([
    // Five of six lines, all at the lowest roll: 5 x 0.5 of 6 shares = 2.5 stars.
    { slot: "Main hand", itemId: "Artemis", rolls: [0, 0, 0, 0, 0] },
    // Five of five at half rolls: 5 x 0.75 of 5 shares = 4.5 stars.
    { slot: "Off hand", itemId: "Arrowcatch Wall", rolls: [50, 50, 50, 50, 50] },
    { slot: "Chest", itemId: "Armor_Agi", rolls: [] },
  ]));
  expect(ratings(state)).toEqual({ "Main hand": 2.5, "Off hand": 4.5, Chest: 0 });
});

test("lays the slots out like the game's equipment screen and leaves empty ones blank", () => {
  const state = rateGear(snapshot([{ slot: "Feet", itemId: "Arrowcatch Wall", rolls: [100] }]));
  expect(state.slots).toHaveLength(10);
  expect(state.slots.map((slot) => slot?.slot ?? null)).toEqual([null, null, null, null, null, null, null, "Feet", null, null]);
  expect(rateGear(undefined).slots.every((slot) => slot === null)).toBe(true);
});
