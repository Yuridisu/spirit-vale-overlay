import { afterEach, beforeEach, expect, jest, test } from "bun:test";

import type { OverlayGearPickupEvent } from "../app-types.ts";
import { gearPickups, pushGearPickup } from "./store.ts";

const pickup = (displayName: string): OverlayGearPickupEvent => ({ itemId: displayName, displayName, refine: 0, stats: [] });
const shown = (): string[] => gearPickups.value.map((card) => card.event.displayName);

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => {
  jest.runAllTimers();
  jest.useRealTimers();
});

test("shows gear picked up together one card at a time", () => {
  pushGearPickup(pickup("First"));
  pushGearPickup(pickup("Second"));
  expect(shown()).toEqual(["First"]);

  jest.advanceTimersByTime(6_000);
  expect(shown()).toEqual(["Second"]);

  jest.advanceTimersByTime(15_000);
  expect(shown()).toEqual([]);
});

test("keeps a lone card for its full lifetime", () => {
  pushGearPickup(pickup("Only"));
  jest.advanceTimersByTime(14_000);
  expect(shown()).toEqual(["Only"]);
  jest.advanceTimersByTime(1_000);
  expect(shown()).toEqual([]);
});

test("hands over at once when the card on screen has already had its guaranteed time", () => {
  pushGearPickup(pickup("Earlier"));
  jest.advanceTimersByTime(10_000);
  pushGearPickup(pickup("Later"));
  jest.advanceTimersByTime(0);
  expect(shown()).toEqual(["Later"]);
});
