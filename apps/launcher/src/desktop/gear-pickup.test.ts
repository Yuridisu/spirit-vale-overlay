import { expect, test } from "bun:test";

import { snapshot } from "@svoverlay/build-export";

import { describeArtifactPickup, describeGearPickup } from "./gear-pickup.ts";

test("describes a picked-up artifact by its set name and piece, scaled with the artifact ranges", () => {
  expect(describeArtifactPickup({
    itemId: "Acolyte",
    slot: 1,
    refine: 2,
    substats: [{ type: 4, roll: 100 }, { type: 70, roll: 0 }],
  })).toEqual({
    itemId: "Acolyte",
    displayName: "Holy Vow",
    slot: "Jewel",
    refine: 2,
    stats: [
      { label: "Int", roll: 100, value: 3 },
      { label: "Matk %", roll: 0, value: 1 },
    ],
  });
});

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

test("names stats the way the game's tooltip does", () => {
  const type = (name: string) => Number(Object.entries(snapshot.statTypes).find(([, value]) => value === name)![0]);
  const card = describeGearPickup({
    itemId: "Repeater Crossbow",
    refine: 0,
    substats: [{ type: type("DoubleAttack"), roll: 100 }, { type: type("AtkSpd"), roll: 100 }],
  });
  expect(card.stats.map((stat) => stat.label)).toEqual(["Multistrike", "Attack Speed"]);
});
