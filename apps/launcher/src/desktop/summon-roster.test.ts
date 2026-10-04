import { expect, test } from "bun:test";
import type { CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";

import { SUMMON_GONE_GRACE_MS, SummonRoster, summonName } from "./summon-roster.ts";

const CONNECTION = "local:5000#1";
const OWNER = 48_548;

function packed(value: number): Buffer {
  let raw = BigInt(value < 0 ? (-value * 2) - 1 : value * 2);
  const bytes: number[] = [];
  do {
    let byte = Number(raw & 0x7fn);
    raw >>= 7n;
    if (raw > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (raw > 0n);
  return Buffer.from(bytes);
}

function packet(fields: Partial<CapturedFishNetPacket>): CapturedFishNetPacket {
  return { tick: 1, packetId: 1, packetName: "syncType", raw: Buffer.alloc(0), payload: Buffer.alloc(0), connectionId: CONNECTION, ...fields } as CapturedFishNetPacket;
}

function summoning(objectId: number, owner: number | undefined, skill: string | undefined, connectionId = CONNECTION): CapturedFishNetPacket {
  return packet({
    objectId,
    connectionId,
    networkBehaviourType: "SummoningComponent",
    syncEntries: [
      ...(owner === undefined ? [] : [{ name: "SummonerSync", fields: [{ name: "SummonerSync", value: owner }] }]),
      ...(skill === undefined ? [] : [{ name: "SummonSkillSync", fields: [{ name: "SkillId", value: skill }] }]),
    ],
  } as Partial<CapturedFishNetPacket>);
}

function health(objectId: number, current: number, maximum?: number): CapturedFishNetPacket {
  const payload = Buffer.concat([Buffer.from([0]), packed(current), ...(maximum === undefined ? [] : [Buffer.from([1]), packed(maximum)])]);
  return packet({ objectId, networkBehaviourType: "HealthComponent", payload, raw: payload });
}

test("lists the local player's summons with their health, in the order they were raised", () => {
  const roster = new SummonRoster();
  // Health may come before the object is known to be a summon.
  roster.consume(health(10, 16_180, 16_180));
  expect(roster.consume(summoning(10, OWNER, "SummonSkeletonMage"))).toBe(true);
  roster.consume(summoning(11, OWNER, undefined));
  roster.consume(summoning(11, undefined, "SummonAbomination"));
  roster.consume(health(11, 12_000, 20_594));
  roster.consume(summoning(12, 7, "SummonSkeleton"));

  expect(roster.state(CONNECTION, OWNER)).toEqual({
    rows: [
      { id: `${CONNECTION}\u000010`, objectId: 10, name: "Skeleton Mage", iconId: "Skeleton02", health: 16_180, maxHealth: 16_180 },
      { id: `${CONNECTION}\u000011`, objectId: 11, name: "Abomination", iconId: "SummonAbomination", health: 12_000, maxHealth: 20_594 },
    ],
  });
  expect(roster.state(CONNECTION, 7).rows.map((row) => row.name)).toEqual(["Skeleton"]);
});

test("follows health changes, and drops a summon only once it stays quiet after being reported gone", () => {
  let now = 0;
  const roster = new SummonRoster(() => now);
  roster.consume(summoning(10, OWNER, "SummonSkeleton"));
  roster.consume(health(10, 17_401, 17_401));
  expect(roster.consume(health(10, 9_000))).toBe(true);
  expect(roster.state(CONNECTION, OWNER).rows[0]).toMatchObject({ health: 9_000, maxHealth: 17_401 });

  // The server despawns summons that are still out; while it goes on sending about one, it stays.
  expect(roster.consume(packet({ packetName: "objectDespawn", objectId: 10 }))).toBe(true);
  now = 3_000;
  roster.consume(health(10, 8_000));
  now = 9_000;
  expect(roster.state(CONNECTION, OWNER).rows).toMatchObject([{ health: 8_000 }]);

  // Gone and quiet past the grace: it is gone.
  roster.consume(packet({ packetName: "objectDespawn", objectId: 10 }));
  now += SUMMON_GONE_GRACE_MS - 1;
  expect(roster.state(CONNECTION, OWNER).rows).toHaveLength(1);
  now += 1;
  expect(roster.state(CONNECTION, OWNER).rows).toEqual([]);
});

test("keeps the summons a re-authentication carries over, and forgets a closed connection", () => {
  let now = 0;
  const roster = new SummonRoster(() => now);
  roster.consume(summoning(20, OWNER, "Reanimation"));
  roster.consume(summoning(21, OWNER, "SummonSkeletonMage"));
  roster.consume(summoning(22, OWNER, "SummonSkeleton", "other-connection"));

  // A tower floor re-authenticates; the mage keeps fighting, the reanimation was left behind.
  roster.consume(packet({ packetName: "authenticated" }));
  now = 1_000;
  roster.consume(health(21, 15_000, 16_180));
  now = 1_000 + SUMMON_GONE_GRACE_MS;
  expect(roster.state(CONNECTION, OWNER).rows.map((row) => row.name)).toEqual(["Skeleton Mage"]);

  expect(roster.consume(packet({ packetName: "disconnect" }))).toBe(true);
  expect(roster.state(CONNECTION, OWNER).rows).toEqual([]);
  expect(roster.state("other-connection", OWNER).rows).toHaveLength(1);
});

test("reads a summon raised in its spawn, and treats a reused object id as a new object", () => {
  const roster = new SummonRoster();
  const spawn = (objectId: number, skill: string) => packet({
    packetName: "objectSpawn",
    objectId,
    spawnSyncEntries: [
      { name: "SummonerSync", networkBehaviourType: "SummoningComponent", componentIndex: 0, fields: [{ name: "SummonerSync", value: OWNER }] },
      { name: "SummonSkillSync", networkBehaviourType: "SummoningComponent", componentIndex: 0, fields: [{ name: "SkillId", value: skill }] },
      { name: "healthSync", networkBehaviourType: "HealthComponent", componentIndex: 1, fields: [{ name: "healthSync", value: 18_434 }] },
      { name: "maxHealthSync", networkBehaviourType: "HealthComponent", componentIndex: 1, fields: [{ name: "maxHealthSync", value: 18_434 }] },
    ],
  } as Partial<CapturedFishNetPacket>);
  roster.consume(spawn(30, "Reanimation"));
  expect(roster.state(CONNECTION, OWNER).rows).toEqual([
    { id: `${CONNECTION}\u000030`, objectId: 30, name: "Reanimation", iconId: "Necromancer5", health: 18_434, maxHealth: 18_434 },
  ]);
  roster.consume(spawn(30, "SummonSkeleton"));
  expect(roster.state(CONNECTION, OWNER).rows.map((row) => row.name)).toEqual(["Skeleton"]);
});

test("names a summon by its skill, without the word Summon", () => {
  expect(summonName("SummonSkeletonMage")).toBe("Skeleton Mage");
  expect(summonName("Reanimation")).toBe("Reanimation");
  expect(summonName("SummonFutureThing")).toBe("Future Thing");
});
