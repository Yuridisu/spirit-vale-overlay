import { expect, test } from "bun:test";

import { DamageTakenTracker } from "./damage-taken.ts";

test("adds up hits by attacker and attack, largest first", () => {
  const tracker = new DamageTakenTracker();
  tracker.observe({ label: "Basic Attack", attacker: "Ember Hound", damage: 100 }, 1_000);
  tracker.observe({ label: "Basic Attack", attacker: "Ember Hound", damage: 150 }, 2_000);
  tracker.observe({ label: "Stomp", attacker: "Ember Hound", damage: 400 }, 3_000);
  tracker.observe({ label: "Basic Attack", attacker: "Digger", damage: 30 }, 4_000);
  tracker.observe({ label: "Bleeding", damage: 20 }, 5_000);

  expect(tracker.state()).toEqual({
    total: 700,
    rows: [
      { label: "Stomp", attacker: "Ember Hound", damage: 400, hits: 1 },
      { label: "Basic Attack", attacker: "Ember Hound", damage: 250, hits: 2 },
      { label: "Basic Attack", attacker: "Digger", damage: 30, hits: 1 },
      { label: "Bleeding", damage: 20, hits: 1 },
    ],
  });
});

test("ignores hits that did no damage", () => {
  const tracker = new DamageTakenTracker();
  tracker.observe({ label: "Basic Attack", damage: 0 }, 1_000);
  expect(tracker.state()).toEqual({ total: 0, rows: [] });
});

test("starts a new tally after a long quiet spell", () => {
  const tracker = new DamageTakenTracker();
  tracker.observe({ label: "Basic Attack", damage: 100 }, 1_000);
  tracker.observe({ label: "Basic Attack", damage: 100 }, 60_999);
  expect(tracker.state().total).toBe(200);

  tracker.observe({ label: "Stomp", damage: 50 }, 121_000);
  expect(tracker.state()).toEqual({ total: 50, rows: [{ label: "Stomp", damage: 50, hits: 1 }] });
});

test("keeps the killing blow on show after the tally starts over", () => {
  const tracker = new DamageTakenTracker();
  tracker.observe({ label: "Stomp", attacker: "Ember Hound", damage: 400 }, 1_000);
  tracker.observeDeath({ label: "Stomp", attacker: "Ember Hound", damage: 400 }, 1_000);
  expect(tracker.state().killedBy).toEqual({ label: "Stomp", attacker: "Ember Hound", damage: 400, atMs: 1_000 });

  tracker.reset();
  expect(tracker.state()).toEqual({ total: 0, rows: [], killedBy: { label: "Stomp", attacker: "Ember Hound", damage: 400, atMs: 1_000 } });

  tracker.observeDeath({ label: "Bleeding", damage: 12 }, 9_000);
  expect(tracker.state().killedBy).toEqual({ label: "Bleeding", damage: 12, atMs: 9_000 });
});
