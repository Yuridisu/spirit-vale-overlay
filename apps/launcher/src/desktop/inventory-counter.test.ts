import { expect, test } from "bun:test";

import { InventoryCounter } from "./inventory-counter.ts";

test("counts only pickups until the bag is reported, then carries the bag forward", () => {
  const counter = new InventoryCounter();
  expect(counter.addPickup([{ name: "Spider Web", count: 2 }])).toBe(true);
  expect(counter.state()).toEqual({ known: false, items: [{ name: "Spider Web", count: 2, gained: 2 }] });

  counter.setBag([{ name: "Spider Web", count: 545 }, { name: "Bat Wing", count: 12 }]);
  counter.addPickup([{ name: "Spider Web", count: 3 }]);
  expect(counter.state()).toEqual({
    known: true,
    items: [
      { name: "Bat Wing", count: 12, gained: 0 },
      { name: "Spider Web", count: 548, gained: 5 },
    ],
  });
});

test("lets a new bag report correct for items that left the bag", () => {
  const counter = new InventoryCounter();
  counter.setBag([{ name: "Spider Web", count: 545 }]);
  counter.addPickup([{ name: "Spider Web", count: 5 }]);
  counter.setBag([{ name: "Bat Wing", count: 1 }]);

  expect(counter.state().items).toEqual([
    { name: "Bat Wing", count: 1, gained: 0 },
    { name: "Spider Web", count: 0, gained: 5 },
  ]);
});

test("ignores empty pickups and forgets everything on a change of character", () => {
  const counter = new InventoryCounter();
  expect(counter.addPickup([{ name: "Spider Web", count: 0 }])).toBe(false);
  expect(counter.forgetBag()).toBe(false);

  counter.setBag([{ name: "Spider Web", count: 545 }]);
  expect(counter.forgetBag()).toBe(true);
  expect(counter.state()).toEqual({ known: false, items: [] });
});
