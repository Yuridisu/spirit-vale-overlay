import type { CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
import type { BossHealth } from "@svoverlay/contracts/dark-fortress";

/**
 * Every object's health as its HealthComponent sends it: the values in its spawn, then each
 * healthSync / maxHealthSync update. Bosses run past a hundred million, so nothing is capped.
 */
export class MobHealthTracker {
  private readonly health = new Map<number, { current?: number; max?: number; peak?: number }>();

  /** Reads a packet; returns the object whose health it changed, if any. */
  consume(packet: CapturedFishNetPacket): number | undefined {
    const objectId = packet.objectId;
    if (objectId === undefined) return undefined;
    if (packet.packetName === "objectDespawn") {
      this.health.delete(objectId);
      return undefined;
    }
    if (packet.packetName === "objectSpawn") {
      let current: number | undefined;
      let max: number | undefined;
      for (const entry of packet.spawnSyncEntries ?? []) {
        if (entry.networkBehaviourType !== "HealthComponent") continue;
        const value = entry.fields.find((field) => field.name === entry.name)?.value;
        if (typeof value !== "number") continue;
        if (entry.name === "healthSync") current = value;
        else if (entry.name === "maxHealthSync") max = value;
      }
      return this.set(objectId, current, max) ? objectId : undefined;
    }
    if (packet.packetName === "syncType" && packet.networkBehaviourType === "HealthComponent" && packet.payload.length > 0) {
      const values = readPackedPairs(packet.payload);
      return this.set(objectId, values.get(0), values.get(1)) ? objectId : undefined;
    }
    return undefined;
  }

  /**
   * The object's health. A boss's spawn carries no maximum and the game sends it only later, so
   * until then the highest health seen stands in for it (a boss is first seen at full health).
   */
  get(objectId: number): BossHealth | undefined {
    const entry = this.health.get(objectId);
    const max = entry?.max ?? entry?.peak;
    if (entry?.current === undefined || max === undefined || max <= 0) return undefined;
    return { current: Math.max(0, Math.min(entry.current, max)), max };
  }

  reset(): void {
    this.health.clear();
  }

  private set(objectId: number, current: number | undefined, max: number | undefined): boolean {
    const usable = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0;
    if (!usable(current) && !usable(max)) return false;
    const entry = this.health.get(objectId) ?? {};
    if (usable(current)) {
      entry.current = current;
      entry.peak = Math.max(entry.peak ?? 0, current!);
    }
    if (usable(max)) entry.max = max;
    this.health.set(objectId, entry);
    return true;
  }
}

function readPackedPairs(payload: Buffer): Map<number, number> {
  const values = new Map<number, number>();
  let offset = 0;
  try {
    while (offset < payload.length) {
      const index = payload.readUInt8(offset);
      offset += 1;
      const { value, next } = readPacked(payload, offset);
      offset = next;
      values.set(index, value);
    }
  } catch {
    // A malformed or unknown tail invalidates everything after the last good pair.
  }
  return values;
}

function readPacked(payload: Buffer, start: number): { value: number; next: number } {
  let raw = 0n;
  let shift = 0n;
  let offset = start;
  for (let count = 0; count < 10; count += 1) {
    if (offset >= payload.length) throw new Error("truncated packed integer");
    const byte = payload[offset++]!;
    raw |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      const value = Number((raw >> 1n) ^ (-(raw & 1n)));
      if (!Number.isSafeInteger(value)) throw new Error("packed integer exceeds safe range");
      return { value, next: offset };
    }
    shift += 7n;
  }
  throw new Error("invalid packed integer");
}
