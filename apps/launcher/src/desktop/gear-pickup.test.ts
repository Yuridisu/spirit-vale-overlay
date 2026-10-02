import { expect, test } from "bun:test";

import { describeGearPickup } from "./gear-pickup.ts";

test("describes a picked-up shield with its rolls scaled to the values the game shows", () => {
  expect(describeGearPickup({
    itemId: "Arrowcatch Wall",
    refine: 1,
    substats: [
      { type: 1, roll: 65 },
      { type: 71, roll: 86 },
      { type: 11, roll: 97 },
      { type: 121, roll: 62 },
    ],
  })).toEqual({
    itemId: "Arrowcatch Wall",
    displayName: "Arrowcatch Wall",
    slot: "Shield",
    refine: 1,
    stats: [
      { label: "Vit", roll: 65, value: 3 },
      { label: "Hp %", roll: 86, value: 10 },
      { label: "Def", roll: 97, value: 10 },
      { label: "Perfect Dodge", roll: 62, value: 4 },
    ],
  });
});

test("keeps the roll of a stat whose range is unknown, and an item the catalog does not list", () => {
  expect(describeGearPickup({
    itemId: "Synthetic Unlisted Item",
    refine: 0,
    substats: [{ type: 71, roll: 40 }, { type: 99_999, roll: 12, qualifier: "Fire" }],
  })).toEqual({
    itemId: "Synthetic Unlisted Item",
    displayName: "Synthetic Unlisted Item",
    refine: 0,
    stats: [
      { label: "Hp %", roll: 40 },
      { label: "Stat 99999", roll: 12, qualifier: "Fire" },
    ],
  });
});
