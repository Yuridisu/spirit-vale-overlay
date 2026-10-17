import { expect, test } from "bun:test";

import { DarkFortressTracker } from "./dark-fortress.ts";
import { MobHealthTracker } from "./mob-health.ts";

const WIZARD = "NightmareWizardBoss";
const PALADIN = "NightmarePaladinBoss";

const row = (tracker: DarkFortressTracker, mobId: string, healthOf?: (id: number) => { current: number; max: number } | undefined) =>
  tracker.state(healthOf).bosses.find((boss) => boss.mobId === mobId);

test("lists the seven bosses, alive with health, dead with the time, or not seen yet", () => {
  const tracker = new DarkFortressTracker();
  tracker.setChannel(2, "sa");
  expect(tracker.state().bosses.map((boss) => [boss.name, boss.status])).toEqual([
    ["Berserker", "unknown"], ["Gunslinger", "unknown"], ["Necromancer", "unknown"], ["Paladin", "unknown"],
    ["Priest", "unknown"], ["Shinobi", "unknown"], ["Wizard", "unknown"],
  ]);
  expect(tracker.noteAlive(WIZARD, 900, 1_000)).toBe(true);
  expect(tracker.noteAlive("Sting", 901, 1_000)).toBe(false);
  expect(row(tracker, WIZARD, (id) => (id === 900 ? { current: 40, max: 160 } : undefined))).toEqual({
    mobId: WIZARD, name: "Wizard", status: "alive", health: { current: 40, max: 160 },
  });
  expect(tracker.noteDeath(WIZARD, 5_000, "Aster")).toBe(true);
  expect(row(tracker, WIZARD)).toEqual({ mobId: WIZARD, name: "Wizard", status: "dead", diedAtMs: 5_000, killedBy: "Aster" });
  expect(tracker.state()).toMatchObject({ channel: 2, region: "sa" });
});

test("an old gravestone does not bury a boss seen alive since, and another channel starts over", () => {
  const tracker = new DarkFortressTracker();
  tracker.setChannel(1, "sa");
  tracker.noteAlive(PALADIN, 700, 100_000);
  expect(tracker.noteDeath(PALADIN, 10_000)).toBe(false);
  expect(row(tracker, PALADIN)?.status).toBe("alive");

  // The region arriving later on the same channel keeps the list.
  const fresh = new DarkFortressTracker();
  fresh.setChannel(3, undefined);
  fresh.noteDeath(PALADIN, 50_000);
  expect(fresh.setChannel(3, "sa")).toBe(false);
  expect(row(fresh, PALADIN)?.status).toBe("dead");
  expect(fresh.setChannel(4, "sa")).toBe(true);
  expect(row(fresh, PALADIN)?.status).toBe("unknown");
});

test("reads a monster's health from its spawn and its updates, past a hundred million", () => {
  const health = new MobHealthTracker();
  const spawn = {
    packetName: "objectSpawn", objectId: 900, payload: Buffer.alloc(0), raw: Buffer.alloc(0), tick: 1,
    spawnSyncEntries: [
      { componentIndex: 1, networkBehaviourType: "HealthComponent", index: 0, name: "healthSync", fields: [{ name: "healthSync", value: 157_000_000 }] },
      { componentIndex: 1, networkBehaviourType: "HealthComponent", index: 1, name: "maxHealthSync", fields: [{ name: "maxHealthSync", value: 157_000_000 }] },
    ],
  };
  expect(health.consume(spawn as never)).toBe(900);
  expect(health.get(900)).toEqual({ current: 157_000_000, max: 157_000_000 });
  // healthSync (index 0) = 60,000,000 as a zigzag packed integer.
  const zigzag = (value: number) => {
    const bytes: number[] = [];
    let raw = BigInt(value) * 2n;
    do { let byte = Number(raw & 0x7fn); raw >>= 7n; if (raw > 0n) byte |= 0x80; bytes.push(byte); } while (raw > 0n);
    return bytes;
  };
  const update = { packetName: "syncType", networkBehaviourType: "HealthComponent", objectId: 900, payload: Buffer.from([0, ...zigzag(60_000_000)]), raw: Buffer.alloc(0), tick: 2 };
  expect(health.consume(update as never)).toBe(900);
  expect(health.get(900)).toEqual({ current: 60_000_000, max: 157_000_000 });
  health.consume({ packetName: "objectDespawn", objectId: 900, payload: Buffer.alloc(0), raw: Buffer.alloc(0), tick: 3 } as never);
  expect(health.get(900)).toBeUndefined();
});

test("a boss that died stays dead while its corpse still sends updates, until another one spawns", () => {
  const tracker = new DarkFortressTracker();
  tracker.setChannel(2, "sa");
  tracker.noteAlive(WIZARD, 900, 1_000);
  tracker.noteAlive(WIZARD, 900, 50_000);
  expect(tracker.noteDeath(WIZARD, 60_000, "Aster", 900)).toBe(true);
  expect(tracker.noteAlive(WIZARD, 900, 61_000)).toBe(false);
  expect(row(tracker, WIZARD)).toMatchObject({ status: "dead", diedAtMs: 60_000 });
  // Its gravestone, read a moment later, does not change the death.
  expect(tracker.noteDeath(WIZARD, 60_000)).toBe(false);
  // An hour on, a new Wizard spawns as another object.
  expect(tracker.noteAlive(WIZARD, 950, 3_700_000)).toBe(true);
  expect(row(tracker, WIZARD)?.status).toBe("alive");
});

test("a gravestone newer than the boss in sight kills it", () => {
  const tracker = new DarkFortressTracker();
  tracker.setChannel(1, "sa");
  tracker.noteAlive(PALADIN, 700, 10_000);
  expect(tracker.noteDeath(PALADIN, 90_000)).toBe(true);
  expect(row(tracker, PALADIN)).toMatchObject({ status: "dead", diedAtMs: 90_000 });
  expect(tracker.noteAlive(PALADIN, 700, 95_000)).toBe(false);
});

test("a boss's health stands in for its maximum until the game sends one", () => {
  const health = new MobHealthTracker();
  const sync = (value: number) => {
    const bytes: number[] = [];
    let raw = BigInt(value) * 2n;
    do { let byte = Number(raw & 0x7fn); raw >>= 7n; if (raw > 0n) byte |= 0x80; bytes.push(byte); } while (raw > 0n);
    return { packetName: "syncType", networkBehaviourType: "HealthComponent", objectId: 5, payload: Buffer.from([0, ...bytes]), raw: Buffer.alloc(0), tick: 1 } as never;
  };
  health.consume(sync(130_000_000));
  health.consume(sync(97_500_000));
  expect(health.get(5)).toEqual({ current: 97_500_000, max: 130_000_000 });
});
