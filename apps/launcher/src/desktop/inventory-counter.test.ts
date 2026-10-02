import { expect, test } from "bun:test";

import { InventoryCounter } from "./inventory-counter.ts";

test("counts only pickups until the bag is reported", () => {
  const counter = new InventoryCounter();
  expect(counter.addPickup([{ name: "Spider Web", count: 2 }], 1_000)).toBe(true);
  expect(counter.state()).toEqual({ known: false, items: [{ name: "Spider Web", count: 2, gained: 2 }] });
});

test("does not add a pickup the bag report beside it already counts", () => {
  const counter = new InventoryCounter();
  counter.setBag([{ name: "Spider Web", count: 548 }, { name: "Bat Wing", count: 12 }], 10_000);
  counter.addPickup([{ name: "Spider Web", count: 3 }], 10_050);

  expect(counter.state()).toEqual({
    known: true,
    items: [
      { name: "Bat Wing", count: 12, gained: 0 },
      { name: "Spider Web", count: 548, gained: 3 },
    ],
  });
});

test("adds a pickup that came with no bag report, until the next report corrects the count", () => {
  const counter = new InventoryCounter();
  counter.setBag([{ name: "Spider Web", count: 545 }], 10_000);
  counter.addPickup([{ name: "Spider Web", count: 5 }], 20_000);
  expect(counter.state().items).toEqual([{ name: "Spider Web", count: 550, gained: 5 }]);

  counter.setBag([{ name: "Bat Wing", count: 1 }], 30_000);
  expect(counter.state().items).toEqual([
    { name: "Bat Wing", count: 1, gained: 0 },
    { name: "Spider Web", count: 0, gained: 5 },
  ]);
});

test("ignores empty pickups and forgets everything on a change of character", () => {
  const counter = new InventoryCounter();
  expect(counter.addPickup([{ name: "Spider Web", count: 0 }], 0)).toBe(false);
  expect(counter.forgetBag()).toBe(false);

  counter.setBag([{ name: "Spider Web", count: 545 }], 0);
  expect(counter.forgetBag()).toBe(true);
  expect(counter.state()).toEqual({ known: false, items: [] });
});
