import {
  DARK_FORTRESS_BOSSES,
  isDarkFortressBoss,
  type BossHealth,
  type DarkFortressState,
} from "@svoverlay/contracts/dark-fortress";

interface Sighting {
  status: "alive" | "dead";
  /** The boss's object while it is in sight, for its health. */
  objectId?: number;
  /** When it was last seen alive, so an older gravestone does not bury a boss that came back. */
  seenAliveAtMs?: number;
  diedAtMs?: number;
  killedBy?: string;
}

/**
 * The seven Dark Fortress bosses on the channel the player is on: seen alive, killed (by a death in
 * sight, or a gravestone found later) or not seen yet. Another channel starts the list over.
 */
export class DarkFortressTracker {
  private place: { region?: string; channel: number } | undefined;
  private readonly bosses = new Map<string, Sighting>();
  /** Boss objects that died: the corpse keeps sending updates for a while, and must not come back alive. */
  private readonly deadObjects = new Set<number>();

  /** The channel the player is on. Returns whether that started the list over. */
  setChannel(channel: number, region: string | undefined): boolean {
    const same = this.place !== undefined && this.place.channel === channel
      && (region === undefined || this.place.region === undefined || this.place.region === region);
    if (same) {
      if (region !== undefined && this.place!.region === undefined) this.place = { region, channel };
      return false;
    }
    this.place = { ...(region === undefined ? {} : { region }), channel };
    this.bosses.clear();
    this.deadObjects.clear();
    return true;
  }

  /** A Dark Fortress boss in sight. Returns whether anything changed. */
  noteAlive(mobId: string, objectId: number, nowMs: number): boolean {
    if (!isDarkFortressBoss(mobId) || this.deadObjects.has(objectId)) return false;
    const before = this.bosses.get(mobId);
    const same = before?.status === "alive" && before.objectId === objectId;
    // When this object was first seen alive: a gravestone from before then is an older death.
    this.bosses.set(mobId, { status: "alive", objectId, seenAliveAtMs: same ? before!.seenAliveAtMs : nowMs });
    return !same;
  }

  /** A Dark Fortress boss's death, seen or read off its gravestone. Returns whether anything changed. */
  noteDeath(mobId: string, diedAtMs: number, killedBy?: string, objectId?: number): boolean {
    if (!isDarkFortressBoss(mobId) || !Number.isFinite(diedAtMs)) return false;
    const before = this.bosses.get(mobId);
    if (objectId !== undefined) this.deadObjects.add(objectId);
    // The boss in sight is the one that died, unless a different object died.
    const sameObject = objectId !== undefined && objectId === before?.objectId;
    const newerThanSighting = objectId === undefined && before?.seenAliveAtMs !== undefined && diedAtMs + 1_000 >= before.seenAliveAtMs;
    if (before?.status === "alive" && before.objectId !== undefined && (sameObject || newerThanSighting)) {
      this.deadObjects.add(before.objectId);
      this.bosses.set(mobId, { status: "dead", diedAtMs, ...(killedBy ? { killedBy } : {}) });
      return true;
    }
    // Seen alive after this death: it has respawned since.
    if (before?.status === "alive" && before.seenAliveAtMs !== undefined && before.seenAliveAtMs > diedAtMs + 1_000) return false;
    if (before?.status === "dead" && before.diedAtMs !== undefined && before.diedAtMs >= diedAtMs) return false;
    this.bosses.set(mobId, { status: "dead", diedAtMs, ...(killedBy ? { killedBy } : {}) });
    return true;
  }

  /** The object of a boss in sight, to read its health. */
  objectOf(mobId: string): number | undefined {
    const sighting = this.bosses.get(mobId);
    return sighting?.status === "alive" ? sighting.objectId : undefined;
  }

  isTracked(objectId: number): boolean {
    for (const sighting of this.bosses.values()) if (sighting.status === "alive" && sighting.objectId === objectId) return true;
    return false;
  }

  state(healthOf: (objectId: number) => BossHealth | undefined = () => undefined): DarkFortressState {
    return {
      ...(this.place === undefined ? {} : { channel: this.place.channel }),
      ...(this.place?.region === undefined ? {} : { region: this.place.region }),
      bosses: DARK_FORTRESS_BOSSES.map(({ mobId, name }) => {
        const sighting = this.bosses.get(mobId);
        if (!sighting) return { mobId, name, status: "unknown" as const };
        if (sighting.status === "dead") {
          return { mobId, name, status: "dead" as const, diedAtMs: sighting.diedAtMs!, ...(sighting.killedBy ? { killedBy: sighting.killedBy } : {}) };
        }
        const health = sighting.objectId === undefined ? undefined : healthOf(sighting.objectId);
        return { mobId, name, status: "alive" as const, ...(health ? { health } : {}) };
      }),
    };
  }
}
