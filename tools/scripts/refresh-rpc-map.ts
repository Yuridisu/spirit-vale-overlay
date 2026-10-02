#!/usr/bin/env bun
/**
 * Refreshes the bundled RPC map's wire hashes after a game update, straight from the installed
 * game's `global-metadata.dat`.
 *
 * FishNet numbers a behaviour's RPCs in the order its weaver emitted them, a base class's first,
 * and that order survives in the metadata as the `RpcReader___<Method>___<signature>` stubs. An
 * update that adds or removes an RPC shifts every later hash on that behaviour, which is what
 * breaks decoding. This rewrites the hashes by method name and keeps each RPC's existing
 * parameter codecs; an RPC new to this build is added with no parameters, so it resolves by name
 * and its payload stays undecoded until someone describes it.
 *
 * It does not refresh SyncType indexes, prefab layouts, or struct layouts: those are carried over
 * unchanged and must be checked against a capture when an update touches them.
 *
 * Usage: `bun run tools/scripts/refresh-rpc-map.ts <path/to/SpiritVale>` (the folder holding
 * `SpiritVale_Data`). The game is only read from disk and need not be running.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FISHNET_RPC_MAP } from "../packages/capture/src/fishnet/generated/rpc-map/index.ts";
import type { FishNetRpcDefinition } from "../packages/capture/src/fishnet/schema/rpc-map.ts";
import { readMetadataTypes, rpcMethodOrder } from "./extract/il2cpp-metadata.ts";

const METADATA_RELATIVE_PATH = "SpiritVale_Data/il2cpp_data/Metadata/global-metadata.dat";
const GENERATOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "generate-rpc-map.ts");

type Rpc = FishNetRpcDefinition;
interface Behaviour { typeName: string; rpcs: readonly Rpc[]; syncTypes?: readonly unknown[] }

function shortName(typeName: string): string {
  return typeName.slice(typeName.lastIndexOf(".") + 1);
}

/** The weaver's own naming is the only hint for an RPC no earlier map described. */
function inferPacketKind(methodName: string): Rpc["packetKind"] {
  if (methodName.endsWith("_T")) return "targetRpc";
  if (methodName.endsWith("_O") || methodName.endsWith("_C")) return "observersRpc";
  return "serverRpc";
}

/** Overloads share a method name, so each is keyed by its position among its namesakes. */
function occurrenceKeys(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const index = seen.get(name) ?? 0;
    seen.set(name, index + 1);
    return `${name}#${index}`;
  });
}

function main(): void {
  const gameDirectory = process.argv[2];
  if (!gameDirectory) throw new Error("Usage: bun run tools/scripts/refresh-rpc-map.ts <path/to/SpiritVale>");
  const metadataFile = path.join(gameDirectory, METADATA_RELATIVE_PATH);
  const types = readMetadataTypes(metadataFile);
  const behaviours = FISHNET_RPC_MAP.behaviours as readonly Behaviour[];

  const ownOrder = new Map<string, string[]>();
  for (const behaviour of behaviours) {
    if (behaviour.rpcs.length === 0) continue;
    const candidates = types.filter((type) => type.name === shortName(behaviour.typeName) && rpcMethodOrder(type).length > 0);
    if (candidates.length !== 1) {
      throw new Error(`${behaviour.typeName}: expected one type with RPCs in the metadata, found ${candidates.length}`);
    }
    ownOrder.set(behaviour.typeName, rpcMethodOrder(candidates[0]!));
  }

  // A derived behaviour's map carries its base's RPCs under the base's own hashes, whatever order it lists them in.
  const baseOf = (behaviour: Behaviour): Behaviour | undefined => behaviours.find((candidate) =>
    candidate !== behaviour
    && candidate.rpcs.length > 0
    && candidate.rpcs.length < behaviour.rpcs.length
    && candidate.rpcs.every((rpc) => behaviour.rpcs.some((own) =>
      own.methodName === rpc.methodName && own.wireHash === rpc.wireHash)));

  const refreshed = behaviours.map((behaviour) => {
    if (behaviour.rpcs.length === 0) return behaviour;
    const base = baseOf(behaviour);
    const order = [...(base ? ownOrder.get(base.typeName)! : []), ...ownOrder.get(behaviour.typeName)!];
    const previousKeys = occurrenceKeys(behaviour.rpcs.map((rpc) => rpc.methodName));
    const previous = new Map(behaviour.rpcs.map((rpc, index) => [previousKeys[index]!, rpc]));
    const orderKeys = occurrenceKeys(order);
    const added: string[] = [];
    let moved = 0;
    const rpcs = order.map((methodName, wireHash): Rpc => {
      const known = previous.get(orderKeys[wireHash]!);
      if (!known) {
        added.push(`${methodName}=${wireHash}`);
        return { wireHash, packetKind: inferPacketKind(methodName), methodName };
      }
      if (known.wireHash !== wireHash) moved += 1;
      return { ...known, wireHash };
    });
    const removed = [...previous.keys()].filter((key) => !orderKeys.includes(key));
    if (moved > 0 || added.length > 0 || removed.length > 0) {
      console.log(
        `${behaviour.typeName}: ${moved} renumbered`
          + (base ? ` (base ${base.typeName})` : "")
          + (added.length > 0 ? `; added ${added.join(", ")}` : "")
          + (removed.length > 0 ? `; removed ${removed.join(", ")}` : ""),
      );
    }
    return { ...behaviour, rpcs };
  });

  const buildFingerprint = createHash("sha256").update(readFileSync(metadataFile)).digest("hex");
  const workDirectory = mkdtempSync(path.join(tmpdir(), "spirit-vale-rpc-"));
  try {
    const rpcBuildFile = path.join(workDirectory, "rpc-build.json");
    const prefabLayoutsFile = path.join(workDirectory, "prefab-layouts.json");
    writeFileSync(rpcBuildFile, JSON.stringify({
      wireMap: {
        buildFingerprint,
        metadataVersion: FISHNET_RPC_MAP.metadataVersion,
        behaviours: refreshed,
        broadcasts: FISHNET_RPC_MAP.broadcasts,
      },
    }));
    writeFileSync(prefabLayoutsFile, JSON.stringify({ prefabs: FISHNET_RPC_MAP.prefabs, rpcPrefabs: FISHNET_RPC_MAP.prefabs }));
    const result = Bun.spawnSync(["bun", "run", GENERATOR, rpcBuildFile, prefabLayoutsFile], { stdout: "inherit", stderr: "inherit" });
    if (result.exitCode !== 0) throw new Error(`generate-rpc-map.ts failed with exit code ${result.exitCode}`);
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
}

main();
