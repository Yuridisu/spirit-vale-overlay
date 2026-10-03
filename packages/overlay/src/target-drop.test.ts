import { expect, test } from "bun:test";

import { isTargetDropUsed, matchTargetDrop, normalizeTargetDrops, TARGET_DROP_SLOTS, TARGET_DROP_STATS } from "./target-drop.ts";

const starfireJewel = {
  displayName: "Starfire",
  slot: "Jewel",
  stats: [{ label: "Int", value: 3 }, { label: "Mp %", value: 2 }, { label: "Matk %", value: 2 }],
};

function targets(...entries: Array<{ name: string; stats?: Array<[string, number]> }>) {
  return normalizeTargetDrops(entries.map((entry) => ({
    name: entry.name,
    stats: (entry.stats ?? []).map(([stat, min]) => ({ stat, min })),
  })));
}

test("keeps a fixed grid of targets and stat rows, with unused ones empty", () => {
  const normalized = normalizeTargetDrops([{ name: "  Starfire Jewel ", stats: [{ stat: "Int", min: 3 }, { stat: 7, min: "x" }] }, "junk"]);
  expect(normalized).toHaveLength(TARGET_DROP_SLOTS);
  expect(normalized[0]!.stats).toHaveLength(TARGET_DROP_STATS);
  expect(normalized[0]!.name).toBe("Starfire Jewel");
  expect(normalized[0]!.stats.slice(0, 2)).toEqual([{ stat: "Int", min: 3 }, { stat: "", min: 0 }]);
  expect(normalized[1]).toMatchObject({ name: "" });
});

test("finds an item by the words of its name and slot, with every asked stat at its minimum", () => {
  expect(matchTargetDrop(targets({ name: "starfire jewel", stats: [["int", 3], ["MP %", 2], ["matk%", 2]] }), starfireJewel)).toBe(0);
  expect(matchTargetDrop(targets({ name: "nothing" }, { name: "Starfire" }), starfireJewel)).toBe(1);
});

test("passes over an item that misses a word, a stat or a minimum", () => {
  expect(matchTargetDrop(targets({ name: "starfire rune" }), starfireJewel)).toBeUndefined();
  expect(matchTargetDrop(targets({ name: "starfire", stats: [["Str", 0]] }), starfireJewel)).toBeUndefined();
  expect(matchTargetDrop(targets({ name: "starfire", stats: [["Int", 4]] }), starfireJewel)).toBeUndefined();
  // `Matk` and `Matk %` are different stats.
  expect(matchTargetDrop(targets({ name: "starfire", stats: [["Matk", 1]] }), starfireJewel)).toBeUndefined();
});

test("lets a stat of unknown value satisfy only a target that asks for no minimum", () => {
  const unknown = { displayName: "Odd Ring", stats: [{ label: "Luk" }] };
  expect(matchTargetDrop(targets({ name: "odd ring", stats: [["Luk", 0]] }), unknown)).toBe(0);
  expect(matchTargetDrop(targets({ name: "odd ring", stats: [["Luk", 1]] }), unknown)).toBeUndefined();
});

test("never matches an unused slot, and matches a stackable item by name alone", () => {
  expect(matchTargetDrop(normalizeTargetDrops(undefined), starfireJewel)).toBeUndefined();
  expect(matchTargetDrop(targets({ name: "box of mastery" }), { displayName: "Box of Mastery", stats: [] })).toBe(0);
  expect(matchTargetDrop(targets({ name: "box of mastery", stats: [["Int", 1]] }), { displayName: "Box of Mastery", stats: [] })).toBeUndefined();
});

test("narrows a target to a type, with or without a name", () => {
  const headgear = { displayName: "Wizard Hat", kind: "equipment" as const, slot: "Head", stats: [{ label: "Int", value: 3 }] };
  const dagger = { displayName: "Kris", kind: "equipment" as const, slot: "Dagger", stats: [] };
  const jewel = { ...starfireJewel, kind: "artifact" as const };
  const card = { displayName: "Poring Card", kind: "item" as const, stats: [] };
  const typed = (type: string, name = "", stats: Array<[string, number]> = []) => normalizeTargetDrops([{ name, type, stats: stats.map(([stat, min]) => ({ stat, min })) }]);

  expect(matchTargetDrop(typed("Head"), headgear)).toBe(0);
  expect(matchTargetDrop(typed("head", "", [["Int", 3]]), headgear)).toBe(0);
  expect(matchTargetDrop(typed("Head", "", [["Int", 4]]), headgear)).toBeUndefined();
  expect(matchTargetDrop(typed("Head"), dagger)).toBeUndefined();
  expect(matchTargetDrop(typed("equipment"), dagger)).toBe(0);
  expect(matchTargetDrop(typed("weapon"), dagger)).toBe(0);
  expect(matchTargetDrop(typed("weapon"), headgear)).toBeUndefined();
  expect(matchTargetDrop(typed("artifact", "", [["Matk %", 2]]), jewel)).toBe(0);
  expect(matchTargetDrop(typed("artifact"), headgear)).toBeUndefined();
  expect(matchTargetDrop(typed("Jewel", "starfire"), jewel)).toBe(0);
  expect(matchTargetDrop(typed("Rune", "starfire"), jewel)).toBeUndefined();
  expect(matchTargetDrop(typed("equipment"), card)).toBeUndefined();
  expect(matchTargetDrop(typed("any", "poring card"), card)).toBe(0);
});

test("reads a target's type and sound, falling back to anything and the default tone", () => {
  const [typed, plain] = normalizeTargetDrops([{ name: "", type: "ARTIFACT", sound: " ding " }, { name: "x", type: "Helmet" }]);
  expect(typed).toMatchObject({ type: "artifact", sound: "ding" });
  expect(plain).toMatchObject({ type: "any", sound: "alert" });
  expect(isTargetDropUsed(typed!)).toBe(true);
  expect(isTargetDropUsed(normalizeTargetDrops(undefined)[0]!)).toBe(false);
});
