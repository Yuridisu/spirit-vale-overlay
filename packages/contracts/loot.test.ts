import { expect, test } from "bun:test";

import { isAlwaysShownLoot } from "./loot.ts";

test("always shows Box of Mastery, whatever its casing", () => {
  expect(isAlwaysShownLoot("Box of Mastery")).toBe(true);
  expect(isAlwaysShownLoot(" box of mastery ")).toBe(true);
});

test("leaves every other drop to the filters", () => {
  expect(isAlwaysShownLoot("Box of Origins")).toBe(false);
  expect(isAlwaysShownLoot(undefined)).toBe(false);
});
