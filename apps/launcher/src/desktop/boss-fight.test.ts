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

test("reports each player's skills, deaths and the loot the boss dropped", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster", archetype: 21 }, { damage: 300, label: "Thunderbolt", critical: true }, 1_000);
  tracker.observeDamage(KRAKEN, { name: "Aster" }, { damage: 100, label: "Basic Attack" }, 2_000);
  tracker.observeDamage(KRAKEN, { name: "Aster" }, { damage: 200, label: "Thunderbolt" }, 3_000);
  tracker.observePlayerDeath("Brook", 3_500);
  tracker.observePlayerDeath("Aster", 3_600);
  tracker.observeDeath(KRAKEN.objectId, 4_000);

  expect(tracker.observeDrop({ objectId: 1, name: "Kraken Ink", rarity: 3 }, 4_200)).toBe(true);
  expect(tracker.observeDrop({ objectId: 1, name: "Kraken Ink", rarity: 3 }, 4_300)).toBe(false);
  expect(tracker.observeDrop({ objectId: 2, name: "Kraken Ink", rarity: 3 }, 4_400)).toBe(true);
  expect(tracker.observeDrop({ objectId: 3, name: "Late Drop" }, 60_000)).toBe(false);
  tracker.observePlayerDeath("Aster", 5_000);

  expect(tracker.reports(5_000)).toEqual([{
    id: "1000-500",
    bossNames: ["Kraken"],
    startedAtMs: 1_000,
    durationMs: 2_000,
    totalDamage: 600,
    active: false,
    defeated: true,
    players: [
      {
        name: "Aster",
        archetype: 21,
        damage: 600,
        hits: 3,
        crits: 1,
        deaths: 1,
        skills: [
          { label: "Thunderbolt", damage: 500, hits: 2, crits: 1 },
          { label: "Basic Attack", damage: 100, hits: 1, crits: 0 },
        ],
      },
      { name: "Brook", damage: 0, hits: 0, crits: 0, deaths: 1, skills: [] },
    ],
    drops: [{ name: "Kraken Ink", rarity: 3, count: 2 }],
  }]);
});

test("keeps finished fights, newest first, across a map change and a restart", () => {
  const tracker = new BossFightTracker();
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  tracker.observeDeath(KRAKEN.objectId, 2_000);
  tracker.reset(3_000);
  tracker.observeDamage(TURTLE, { name: "Aster" }, 50, 10_000);

  const reports = tracker.reports(10_000);
  expect(reports.map((report) => [report.bossNames[0], report.active, report.defeated])).toEqual([
    ["Turtle Champion", true, false],
    ["Kraken", false, true],
  ]);

  const restored = new BossFightTracker([...reports].reverse());
  expect(restored.reports(20_000).map((report) => [report.bossNames[0], report.active])).toEqual([
    ["Turtle Champion", false],
    ["Kraken", false],
  ]);
  expect(restored.state(20_000)).toBeUndefined();
});

test("records the map a fight took place on, and clears finished fights on request", () => {
  const tracker = new BossFightTracker();
  tracker.observeMap("Too Early");
  tracker.observeDamage(KRAKEN, { name: "Aster" }, 100, 1_000);
  tracker.observeMap("Abyss Castle Crypt");
  tracker.observeMap("Somewhere Else");
  tracker.observeDeath(KRAKEN.objectId, 2_000);
  tracker.observeDamage(TURTLE, { name: "Aster" }, 50, 10_000);

  expect(tracker.reports(10_000).map((report) => [report.bossNames[0], report.mapName])).toEqual([
    ["Turtle Champion", undefined],
    ["Kraken", "Abyss Castle Crypt"],
  ]);

  tracker.clearHistory();
  expect(tracker.reports(10_000).map((report) => report.bossNames[0])).toEqual(["Turtle Champion"]);
});
