import { expect, test } from "bun:test";

import type { DecodedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";

import { LootOwnership } from "./loot-ownership.ts";

const ME = ["Testerson", "11111111-2222-3333-4444-555555555555"];

function accountPacket(text: string): DecodedFishNetPacket {
  const payload = Buffer.from(text, "latin1");
  return { tick: 1, packetId: 10, packetName: "targetRpc", raw: payload, payload, rpcName: "CompleteAccountCallback" };
}

test("shows every drop until one of the player's own has been recognised", () => {
  const ownership = new LootOwnership();
  expect(ownership.isLootable({ playerId: "someone-else" }, ME)).toBe(true);
  expect(ownership.isLootable({}, ME)).toBe(true);
});

test("hides drops locked to another player once its own lock format is confirmed", () => {
  const ownership = new LootOwnership();
  expect(ownership.isLootable({ playerId: "Testerson" }, ME)).toBe(true);
  expect(ownership.isLootable({ playerId: "Someone Else" }, ME)).toBe(false);
  expect(ownership.isLootable({ playerId: "Testerson" }, ME)).toBe(true);
  expect(ownership.isLootable({}, ME)).toBe(true);
});

test("recognises a drop locked to the platform account seen at login", () => {
  const ownership = new LootOwnership();
  ownership.observe(accountPacket("\x00\x0cnova-9\x2276561198000000001\x00\x10Testerson\x2276561198000000002"));
  expect(ownership.isLootable({ playerId: "76561198000000001" }, [])).toBe(true);
  expect(ownership.isLootable({ playerId: "76561198000000002" }, [])).toBe(false);
});

test("keeps showing party drops until the player's own party is known to differ", () => {
  const ownership = new LootOwnership();
  expect(ownership.isLootable({ playerId: "Testerson" }, ME)).toBe(true);
  // Confirmed, but the player's party is still unknown, so a party lock is not held against them.
  expect(ownership.isLootable({ playerId: "Party Mate", partyId: 7 }, ME)).toBe(true);

  expect(ownership.isLootable({ playerId: "Testerson", partyId: 7 }, ME)).toBe(true);
  expect(ownership.isLootable({ playerId: "Party Mate", partyId: 7 }, ME)).toBe(true);
  expect(ownership.isLootable({ playerId: "Stranger", partyId: 9 }, ME)).toBe(false);
  expect(ownership.isLootable({ playerId: "Stranger" }, ME)).toBe(false);
});
