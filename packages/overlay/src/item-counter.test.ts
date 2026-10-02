import { expect, test } from "bun:test";

import { ITEM_COUNTER_SLOTS, itemCounterState, normalizeItemCounterItems } from "./item-counter.ts";

test("keeps one trimmed name per slot and fills the rest with free slots", () => {
  const items = normalizeItemCounterItems(["  Spider Web ", 7, "", "Bat Wing"]);
  expect(items).toHaveLength(ITEM_COUNTER_SLOTS);
  expect(items.slice(0, 4)).toEqual(["Spider Web", "", "", "Bat Wing"]);
  expect(normalizeItemCounterItems(undefined).every((name) => name === "")).toBe(true);
});

test("lists the followed items in slot order, whatever the case they were typed in", () => {
  const source = {
    known: true,
    items: [
      { name: "Bat Wing", count: 12, gained: 0 },
      { name: "Spider Web", count: 545, gained: 3 },
    ],
  };
  expect(itemCounterState(["spider web", "", "Dragon Scale", "Spider Web"], source)).toEqual({
    known: true,
    rows: [
      { name: "Spider Web", count: 545, gained: 3 },
      { name: "Dragon Scale", count: 0, gained: 0 },
    ],
  });
});
