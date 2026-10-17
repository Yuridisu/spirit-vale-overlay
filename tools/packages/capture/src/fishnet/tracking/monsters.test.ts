import { describe, expect, test } from "bun:test";

import { FishNetMonsterDirectory } from "./monsters.ts";
import type { DecodedFishNetPacket } from "../types.ts";

const LEVELS = new Map([["training-mob", { level: 2 }]]);

describe("FishNetMonsterDirectory", () => {
  test("identifies a monster from its sync packet", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);

    expect(directory.consume(monsterSync(1, 52))).toMatchObject({
      operation: "upsert",
      objectId: 52,
      spawn: { mobId: "training-mob", level: 2 },
    });
    expect(directory.get(52)).toMatchObject({ mobId: "training-mob" });
  });

  test("identifies a monster from its spawn payload", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);

    directory.consume(monsterSpawn(1, 53));

    expect(directory.get(53)).toMatchObject({ mobId: "training-mob", level: 2 });
  });

  test("reads the side a monster fights on, so a Reanimation on the players' team is told apart", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    const raised = monsterSpawn(1, 54);
    raised.spawnSyncEntries![0]!.fields.push({ name: "Team", typeName: "Team", codec: "packedInt32", value: 0 });
    directory.consume(raised);
    const sync = monsterSync(2, 55);
    sync.decodedFields!.push({ name: "Team", typeName: "Team", codec: "packedInt32", value: 1 });
    directory.consume(sync);

    expect(directory.get(54)).toMatchObject({ mobId: "training-mob", team: 0 });
    expect(directory.get(55)).toMatchObject({ mobId: "training-mob", team: 1 });
    expect(directory.get(55)?.team).toBe(1);
  });

  test("does not report an unchanged identity twice", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);

    expect(directory.consume(monsterSync(1, 52))).toMatchObject({ operation: "upsert", objectId: 52 });
    expect(directory.consume(monsterSync(2, 52))).toBeUndefined();
  });

  test("ignores objects that are not monsters", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    const payload = Buffer.concat([Buffer.from([7]), string("training-mob")]);

    directory.consume({
      tick: 1, packetId: 1, packetName: "syncType", raw: payload, payload,
      objectId: 54, networkBehaviourType: "PlayerController",
    });

    expect(directory.get(54)).toBeUndefined();
  });

  test("forgets a monster once it despawns", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    directory.consume(monsterSync(1, 52));

    expect(directory.consume({
      tick: 2, packetId: 3, packetName: "objectDespawn",
      raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52,
    })).toEqual({ operation: "remove", objectId: 52 });

    expect(directory.get(52)).toBeUndefined();
  });

  test("keeps a monster sent again without its identity, while it has not despawned", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    directory.consume(monsterSync(1, 52));

    expect(directory.consume({
      tick: 2, packetId: 4, packetName: "objectSpawn",
      raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52,
    })).toBeUndefined();
    expect(directory.get(52)).toMatchObject({ mobId: "training-mob" });
  });

  test("keeps a monster that despawns and comes straight back without its identity", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    directory.consume(monsterSync(1, 52));
    const despawn = (tick: number): DecodedFishNetPacket => ({
      tick, packetId: 3, packetName: "objectDespawn", raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52,
    });
    const bareSpawn = (tick: number): DecodedFishNetPacket => ({
      tick, packetId: 4, packetName: "objectSpawn", raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52,
    });

    directory.consume(despawn(10));
    expect(directory.consume(bareSpawn(12))).toMatchObject({ operation: "upsert", objectId: 52, spawn: { mobId: "training-mob" } });
    expect(directory.get(52)).toMatchObject({ mobId: "training-mob" });

    // Long gone, the id may belong to something else now.
    directory.consume(despawn(20));
    expect(directory.consume(bareSpawn(20 + 301))).toBeUndefined();
    expect(directory.get(52)).toBeUndefined();
  });

  test("keeps a despawned monster that is still being hit, and forgets it once its id is spawned again", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    directory.consume(monsterSync(1, 52));
    directory.consume({ tick: 2, packetId: 3, packetName: "objectDespawn", raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52 });
    expect(directory.get(52)).toBeUndefined();

    const hit: DecodedFishNetPacket = {
      tick: 900, packetId: 5, packetName: "rpcLink", rpcName: "ApplyDamage_C", networkBehaviourType: "HealthComponent",
      raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52,
    };
    expect(directory.consume(hit)).toMatchObject({ operation: "upsert", objectId: 52, spawn: { mobId: "training-mob" } });
    expect(directory.get(52)).toMatchObject({ mobId: "training-mob" });

    directory.consume({ tick: 901, packetId: 3, packetName: "objectDespawn", raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52 });
    directory.consume({ tick: 1_300, packetId: 4, packetName: "objectSpawn", raw: Buffer.alloc(0), payload: Buffer.alloc(0), objectId: 52, networkBehaviourType: "PlayerController" });
    expect(directory.consume({ ...hit, tick: 1_301 })).toBeUndefined();
    expect(directory.get(52)).toBeUndefined();
  });

  test("clears everything when the connection restarts", () => {
    const directory = new FishNetMonsterDirectory(LEVELS);
    directory.consume(monsterSync(1, 52));

    expect(directory.consume({
      tick: 2, packetId: 0, packetName: "authenticated", raw: Buffer.alloc(0), payload: Buffer.alloc(0),
    })).toEqual({ operation: "reset" });

    expect(directory.get(52)).toBeUndefined();
  });
});

function monsterSync(tick: number, objectId: number): DecodedFishNetPacket {
  const payload = Buffer.alloc(0);
  return {
    tick, packetId: 1, packetName: "syncType", raw: payload, payload,
    syncIndex: 0, syncName: "Data", objectId, networkBehaviourType: "MonsterController",
    decodedFields: [
      { name: "Id", typeName: "System.String", codec: "stringUtf8Packed", value: "training-mob" },
      { name: "Level", typeName: "System.Int32", codec: "packedInt32", value: 2 },
      { name: "Rank", typeName: "MonsterRank", codec: "packedInt32", value: 0 },
    ],
  };
}

function monsterSpawn(tick: number, objectId: number): DecodedFishNetPacket {
  return {
    tick, packetId: 3, packetName: "objectSpawn", raw: Buffer.alloc(0),
    payload: Buffer.alloc(0), objectId,
    spawnSyncEntries: [{
      index: 0,
      name: "Data",
      componentIndex: 0,
      networkBehaviourType: "MonsterController",
      fields: [
        { name: "Id", typeName: "System.String", codec: "stringUtf8Packed", value: "training-mob" },
        { name: "Level", typeName: "System.Int32", codec: "packedInt32", value: 2 },
        { name: "Rank", typeName: "MonsterRank", codec: "packedInt32", value: 0 },
      ],
    }],
  };
}

function string(value: string): Buffer {
  return Buffer.concat([packed(Buffer.byteLength(value)), Buffer.from(value)]);
}

function packed(value: number | bigint): Buffer {
  const signed = BigInt(value);
  let encoded = (signed << 1n) ^ (signed >> 63n);
  const bytes: number[] = [];
  while (encoded >= 0x80n) { bytes.push(Number(encoded & 0x7fn) | 0x80); encoded >>= 7n; }
  bytes.push(Number(encoded));
  return Buffer.from(bytes);
}
