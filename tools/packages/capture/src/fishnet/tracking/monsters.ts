/** Tracks which monster type each spawned network object is, from the spawn and sync packets the server sends when a monster comes into view. */

import type { DecodedFishNetPacket, FishNetDecodedValue } from "../types.ts";

export interface FishNetMonsterSpawn {
  mobId: string;
  level: number;
  rank?: number;
  /**
   * The side it fights on. Monsters are on team 1; a monster on team 0 fights for the players, as
   * a necromancer's Reanimation does while keeping the identity of the monster it raised.
   */
  team?: number;
}

export type FishNetMonsterDirectoryChange =
  | { operation: "upsert"; objectId: number; spawn: FishNetMonsterSpawn }
  | { operation: "remove"; objectId: number }
  | { operation: "reset" };

/** The spawn payload is scanned at arbitrary offsets, so a known mob's catalog level is what disambiguates a real match from a coincidental one. */
export interface FishNetMonsterLevels {
  get(mobId: string): { readonly level: number } | undefined;
}

/** How long a despawned monster's identity waits for its object to come straight back (~10 s at 30 ticks a second). */
const RESPAWN_GRACE_TICKS = 300;
const MAX_DEPARTED = 2_048;

export class FishNetMonsterDirectory {
  private readonly objects = new Map<number, FishNetMonsterSpawn>();
  /** Monsters just despawned, kept for the same object being sent again without its identity. */
  private readonly departed = new Map<number, { spawn: FishNetMonsterSpawn; tick: number }>();

  constructor(private readonly levels: FishNetMonsterLevels) {}

  /** Returns the identity change caused by this packet, suppressing repeated identical syncs. */
  consume(packet: DecodedFishNetPacket): FishNetMonsterDirectoryChange | undefined {
    if (packet.packetName === "authenticated" || packet.packetName === "disconnect") {
      this.objects.clear();
      this.departed.clear();
      return { operation: "reset" };
    }
    if (packet.packetName === "objectDespawn" && packet.objectId !== undefined) {
      const spawn = this.objects.get(packet.objectId);
      if (!spawn) return undefined;
      this.objects.delete(packet.objectId);
      this.rememberDeparted(packet.objectId, spawn, packet.tick);
      return { operation: "remove", objectId: packet.objectId };
    }
    if (packet.packetName === "objectSpawn" && packet.objectId !== undefined) {
      const spawned = decodeMonsterSpawn(packet, this.levels);
      const departed = this.departed.get(packet.objectId);
      this.departed.delete(packet.objectId);
      if (spawned) return this.set(packet.objectId, spawned);
      // A spawn naming no monster is the same monster sent again (the Echoing Spire does this to
      // monsters mid-fight, its bosses too): still in sight, or back straight after a despawn, the
      // id has not been reused, so the monster keeps its identity.
      if (!this.objects.has(packet.objectId) && departed && packet.tick - departed.tick <= RESPAWN_GRACE_TICKS) {
        return this.set(packet.objectId, departed.spawn);
      }
      return undefined;
    }
    const back = this.backInSight(packet);
    if (back) return back;
    if (packet.packetName !== "syncType" || packet.objectId === undefined
      || (packet.networkBehaviourType !== undefined && packet.networkBehaviourType !== "MonsterController")) {
      return undefined;
    }
    const mobId = stringField(packet, ["Data.Id", "Monster.Id", "Id"]);
    const level = numberField(packet, ["Data.Level", "Monster.Level", "Level"]);
    if (!mobId || level === undefined || !this.levels.get(mobId)) return undefined;
    const rank = numberField(packet, ["Data.Rank", "Monster.Rank", "Rank"]);
    const team = numberField(packet, ["Data.Team", "Monster.Team", "Team"]);
    return this.set(packet.objectId, {
      mobId,
      level,
      ...(rank === undefined ? {} : { rank }),
      ...(team === undefined ? {} : { team }),
    });
  }

  get(objectId: number): FishNetMonsterSpawn | undefined {
    const value = this.objects.get(objectId);
    return value ? { ...value } : undefined;
  }

  reset(): void {
    this.objects.clear();
    this.departed.clear();
  }

  /**
   * A despawned monster still being hit or still sending its health was never really gone (the
   * Echoing Spire despawns its bosses mid-fight and sends no spawn back): it keeps its identity.
   * A reused id always comes with a spawn first, which clears what was remembered.
   */
  private backInSight(packet: DecodedFishNetPacket): FishNetMonsterDirectoryChange | undefined {
    if (packet.objectId === undefined || this.objects.has(packet.objectId)) return undefined;
    if (packet.networkBehaviourType !== "HealthComponent" && packet.networkBehaviourType !== "MonsterController") return undefined;
    const departed = this.departed.get(packet.objectId);
    if (!departed) return undefined;
    this.departed.delete(packet.objectId);
    return this.set(packet.objectId, departed.spawn);
  }

  private rememberDeparted(objectId: number, spawn: FishNetMonsterSpawn, tick: number): void {
    if (this.departed.size >= MAX_DEPARTED) {
      for (const [id, entry] of this.departed) if (tick - entry.tick > RESPAWN_GRACE_TICKS) this.departed.delete(id);
      if (this.departed.size >= MAX_DEPARTED) this.departed.delete(this.departed.keys().next().value!);
    }
    this.departed.set(objectId, { spawn, tick });
  }

  private set(objectId: number, spawn: FishNetMonsterSpawn): FishNetMonsterDirectoryChange | undefined {
    const previous = this.objects.get(objectId);
    this.objects.set(objectId, spawn);
    if (previous?.mobId === spawn.mobId && previous.level === spawn.level && previous.rank === spawn.rank
      && previous.team === spawn.team) {
      return undefined;
    }
    return { operation: "upsert", objectId, spawn: { ...spawn } };
  }
}

/** Reads a monster's identity from its spawn's embedded `Data` (`MonsterDto`) SyncType entry, decoded structurally from the rpc map rather than scanned for. */
export function decodeMonsterSpawn(
  packet: DecodedFishNetPacket,
  levels: FishNetMonsterLevels,
): FishNetMonsterSpawn | undefined {
  const entry = packet.spawnSyncEntries?.find(
    (candidate) => candidate.networkBehaviourType === "MonsterController" && candidate.name === "Data",
  );
  if (!entry) return undefined;
  const mobId = entry.fields.find((field) => field.name === "Id")?.value;
  const level = entry.fields.find((field) => field.name === "Level")?.value;
  const rank = entry.fields.find((field) => field.name === "Rank")?.value;
  const team = entry.fields.find((field) => field.name === "Team")?.value;
  if (typeof mobId !== "string" || !mobId || typeof level !== "number" || !levels.get(mobId)) return undefined;
  return {
    mobId,
    level,
    ...(typeof rank === "number" ? { rank } : {}),
    ...(typeof team === "number" ? { team } : {}),
  };
}

function field(packet: DecodedFishNetPacket, names: readonly string[]): FishNetDecodedValue | undefined {
  for (const name of names) {
    const value = packet.decodedFields?.find((candidate) => candidate.name === name)?.value;
    if (value !== undefined) return value;
  }
  return undefined;
}

function stringField(packet: DecodedFishNetPacket, names: readonly string[]): string | undefined {
  const value = field(packet, names);
  return typeof value === "string" ? value : undefined;
}

function numberField(packet: DecodedFishNetPacket, names: readonly string[]): number | undefined {
  const value = field(packet, names);
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}
