import { expect, test } from "bun:test";

import { isSpireBossFloor, nextSpireBossFloor } from "@svoverlay/contracts/echoing-spire";
import { EchoingSpireTracker, SPIRE_RUN_GRACE_MS } from "./echoing-spire.ts";

test("boss floors are every fifth one, up to the 105th", () => {
  expect([4, 5, 10, 11, 105].map(isSpireBossFloor)).toEqual([false, true, true, false, true]);
  expect(isSpireBossFloor(undefined)).toBe(false);
  expect([1, 5, 6, 101, 105].map(nextSpireBossFloor)).toEqual([5, 5, 10, 105, 105]);
});

test("a run keeps each floor's time, kills and gains, a monster counted once", () => {
  const spire = new EchoingSpireTracker();
  expect(spire.noteTower(true, undefined, 0)).toBe(true);
  expect(spire.noteTower(true, 1, 1_000)).toBe(true);
  expect(spire.noteKill(500, 2_000)).toBe(true);
  // The death after the killing blow names the same monster.
  expect(spire.noteKill(500, 2_000)).toBe(false);
  spire.noteKill(501, 3_000);
  spire.noteRewards(48_750, 450);
  expect(spire.noteTower(true, 2, 61_000)).toBe(true);
  spire.noteKill(500, 62_000);
  const run = spire.state().run!;
  expect(run.floors.map(({ floor, startedAtMs, endedAtMs, kills, experience }) => ({ floor, startedAtMs, endedAtMs, kills, experience }))).toEqual([
    { floor: 1, startedAtMs: 1_000, endedAtMs: 61_000, kills: 2, experience: 48_750 },
    { floor: 2, startedAtMs: 61_000, endedAtMs: undefined, kills: 1, experience: 0 },
  ]);
  expect([run.kills, run.experience, run.coins]).toEqual([3, 48_750, 450]);
  expect(spire.state().floor).toBe(2);
});

test("a boss floor's boss: alive with its health, then its fight time on the floor", () => {
  const spire = new EchoingSpireTracker();
  spire.noteTower(true, 5, 0);
  expect(spire.noteBoss(900, "Echo Wizard Master", 1_000, false)).toBe(true);
  expect(spire.noteBoss(900, "Echo Wizard Master", 4_000, true, 1_000)).toBe(true);
  expect(spire.noteBoss(900, "Echo Wizard Master", 5_000, true, 2_500)).toBe(false);
  expect(spire.state((id) => (id === 900 ? { current: 60, max: 150 } : undefined)).bosses).toEqual([
    { name: "Echo Wizard Master", status: "alive", health: { current: 60, max: 150 }, firstHitAtMs: 4_000 },
  ]);
  spire.noteKill(900, 94_000);
  const state = spire.state();
  expect(state.bosses[0]).toEqual({ name: "Echo Wizard Master", status: "dead", firstHitAtMs: 4_000, diedAtMs: 94_000 });
  expect(state.run!.floors[0]!.bosses).toEqual([{ name: "Echo Wizard Master", fightMs: 90_000, damage: 3_500 }]);
  // Its corpse keeps sending updates: it does not come back.
  expect(spire.noteBoss(900, "Echo Wizard Master", 95_000, true)).toBe(false);
  // The next floor starts without it.
  spire.noteTower(true, 6, 100_000);
  expect(spire.state().bosses).toEqual([]);
});

test("the Umbral curse in sight: Manifestations, cursed players and the player's mark", () => {
  const spire = new EchoingSpireTracker();
  expect(spire.noteManifestation(700, true)).toBe(false);
  spire.noteTower(true, 12, 0);
  expect(spire.noteCursed(600, true)).toBe(true);
  expect(spire.noteCursed(601, true)).toBe(true);
  expect(spire.noteCursed(601, true)).toBe(false);
  expect(spire.noteManifestation(700, true)).toBe(true);
  // The curse wore off one of them.
  expect(spire.state(undefined, { selfCursed: false, marked: true, markExpiresAtMs: 31_000 }, (id) => id === 600).curse).toEqual({
    manifestations: 1, cursedPlayers: 1, selfCursed: false, marked: true, markExpiresAtMs: 31_000,
  });
  expect(spire.forget(700)).toBe(true);
  expect(spire.state().curse.manifestations).toBe(0);
  // Leaving the Spire clears what was in sight.
  spire.noteTower(false, undefined, 2_000);
  expect(spire.state(undefined, { selfCursed: true, marked: true }).curse).toEqual({
    manifestations: 0, cursedPlayers: 0, selfCursed: false, marked: false,
  });
});

test("out for a moment the run carries on; out for longer, or back on a lower floor, a new one starts", () => {
  const spire = new EchoingSpireTracker();
  spire.noteTower(true, 1, 0);
  spire.noteKill(1, 1_000);
  spire.noteTower(true, 2, 10_000);
  // A reconnect between floors.
  spire.noteTower(false, undefined, 20_000);
  expect(spire.state().run!.leftAtMs).toBe(20_000);
  spire.noteTower(true, 2, 30_000);
  expect(spire.state().run!.leftAtMs).toBeUndefined();
  expect(spire.state().run!.floors.length).toBe(2);
  expect(spire.state().history).toEqual([]);

  spire.noteTower(false, undefined, 40_000);
  spire.noteTower(true, 1, 40_000 + SPIRE_RUN_GRACE_MS + 1);
  const state = spire.state();
  expect(state.history).toEqual([{ startedAtMs: 0, endedAtMs: 40_000, firstFloor: 1, lastFloor: 2, kills: 1, experience: 0 }]);
  expect(state.run!.floors.map((floor) => floor.floor)).toEqual([1]);

  // Straight back to floor 1 from floor 3: a new climb.
  spire.noteTower(true, 2, 200_000);
  spire.noteTower(true, 3, 300_000);
  spire.noteTower(true, 1, 400_000);
  expect(spire.state().history.map((run) => run.lastFloor)).toEqual([3, 2]);
});

test("moving between the Spire's maps leaves the bosses behind, with no floor number", () => {
  const spire = new EchoingSpireTracker();
  spire.noteTower(true, undefined, 0);
  expect(spire.noteArea(49)).toBe(false);
  expect(spire.noteArea(50)).toBe(true);
  spire.noteBoss(900, "Broodmother", 1_000, true);
  expect(spire.noteArea(50)).toBe(false);
  expect(spire.state().bosses.length).toBe(1);
  expect(spire.noteArea(49)).toBe(true);
  expect(spire.state().bosses).toEqual([]);
});

test("the floor is the monsters' level less 100: a few of them for the next floor, the boss alone on a boss floor", () => {
  const spire = new EchoingSpireTracker();
  expect(spire.noteMonsterLevel(186, false, 0)).toBe(false);
  spire.noteTower(true, undefined, 0);
  // A climb resumed at floor 86: no floor yet, three monsters of one level call it.
  expect(spire.noteMonsterLevel(186, false, 1_000)).toBe(false);
  expect(spire.noteMonsterLevel(186, false, 1_000)).toBe(false);
  expect(spire.noteMonsterLevel(186, false, 1_000)).toBe(true);
  expect(spire.state().floor).toBe(86);
  // Leftovers of the floor before, and a boss floor's helpers at their own level, move nothing.
  expect(spire.noteMonsterLevel(185, false, 2_000)).toBe(false);
  expect(spire.noteMonsterLevel(125, false, 2_000)).toBe(false);
  expect(spire.noteMonsterLevel(25, false, 2_000)).toBe(false);
  spire.noteMonsterLevel(187, false, 30_000);
  spire.noteMonsterLevel(187, false, 30_000);
  spire.noteMonsterLevel(187, false, 31_000);
  spire.noteMonsterLevel(188, false, 60_000);
  spire.noteMonsterLevel(188, false, 60_000);
  spire.noteMonsterLevel(188, false, 60_000);
  spire.noteMonsterLevel(189, false, 90_000);
  spire.noteMonsterLevel(189, false, 90_000);
  spire.noteMonsterLevel(189, false, 90_000);
  // The boss floor: its boss's level is the floor's.
  expect(spire.noteMonsterLevel(190, true, 120_000)).toBe(true);
  expect(spire.state().run!.floors.map((floor) => [floor.floor, floor.startedAtMs, floor.endedAtMs])).toEqual([
    [86, 1_000, 30_000], [87, 30_000, 60_000], [88, 60_000, 90_000], [89, 90_000, 120_000], [90, 120_000, undefined],
  ]);
  // A lone monster far above is not a floor (a native-level helper, say); many of them are.
  for (let i = 0; i < 9; i += 1) expect(spire.noteMonsterLevel(155 + 100, false, 130_000)).toBe(false);
  expect(spire.state().floor).toBe(90);
});

test("runs are kept newest first, the one in progress included, and come back from disk", () => {
  const spire = new EchoingSpireTracker();
  spire.noteTower(true, 1, 0);
  spire.noteTower(true, 2, 10_000);
  spire.noteTower(false, undefined, 20_000);
  spire.noteTower(true, 1, 20_000 + SPIRE_RUN_GRACE_MS + 1);
  const runs = spire.runs();
  expect(runs.map((run) => run.floors.map((floor) => floor.floor))).toEqual([[1], [1, 2]]);
  expect(runs[1]!.endedAtMs).toBe(20_000);
  expect(runs[1]!.floors[1]!.endedAtMs).toBe(20_000);

  const reopened = new EchoingSpireTracker();
  reopened.restore(runs);
  expect(reopened.runs().map((run) => run.startedAtMs)).toEqual(runs.map((run) => run.startedAtMs));
  expect(reopened.state().history[0]!.lastFloor).toBe(1);
});
