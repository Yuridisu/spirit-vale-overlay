import { expect, test } from "bun:test";

import { BossFightTracker } from "./boss-fight.ts";

const KRAKEN = { objectId: 500, name: "Kraken" };
const TURTLE = { objectId: 501, name: "Turtle Champion" };

test("ranks players by their damage to the boss and measures the fight from first to latest hit", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster", archetype: 21 }, 1_000, 10_000);
  tracker.observeDamage(KRAKEN, { name: "Brook" }, 4_000, 12_000);
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 500, 40_000);
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 500, 60_000);
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 1_000, 82_000);

  expect(tracker.state(82_000)).toEqual({
    bossNames: ["Kraken"],
    totalDamage: 7_000,
    durationMs: 72_000,
    active: true,
    rows: [{ name: "Brook", damage: 4_000 }, { name: "Aster", archetype: 21, damage: 3_000 }],
  });
});

test("keeps two bosses fought together as one fight, ended only when both are dead", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  tracker.observeDamage(TURTLE, { name: "Aster" }, 200, 2_000);
  tracker.observeDeath(KRAKEN.objectId);
  expect(tracker.state(3_000)).toMatchObject({ bossNames: ["Kraken", "Turtle Champion"], totalDamage: 300, active: true });

  tracker.observeDeath(TURTLE.objectId);
  expect(tracker.state(3_000)?.active).toBe(false);
});

test("leaves a finished fight on show and starts over with the next boss hit", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  tracker.observeDeath(KRAKEN.objectId);
  expect(tracker.state(600_000)).toMatchObject({ totalDamage: 100, active: false });

  tracker.observeDamage(TURTLE, { name: "Brook" }, 50, 600_000);
  expect(tracker.state(600_000)).toEqual({
    bossNames: ["Turtle Champion"],
    totalDamage: 50,
    durationMs: 0,
    active: true,
    rows: [{ name: "Brook", damage: 50 }],
  });
});

test("treats boss damage after a long quiet spell as a new fight", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  expect(tracker.state(30_999)?.active).toBe(true);
  expect(tracker.state(31_000)?.active).toBe(false);

  tracker.observeDamage(KRAKEN, { name: "Aster" }, 40, 40_000);
  expect(tracker.state(40_000)).toMatchObject({ totalDamage: 40, durationMs: 0 });
});

test("has nothing to show before any boss is hit, or after a reset", () => {
  const tracker = new BossFightTracker();
  expect(tracker.state(0)).toBeUndefined();
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  tracker.reset();
  expect(tracker.state(2_000)).toBeUndefined();
});
