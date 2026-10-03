import type { CapturedFishNetPacket, FishNetSpawnSyncEntry } from "@kar-mi/spirit-vale-tools-capture";
import type { FishNetActiveStatus } from "@kar-mi/spirit-vale-tools-combat";
import { decodeCharacterRecordSync, decodeCharacterSpawnRecords } from "@kar-mi/spirit-vale-tools-character";
import { resolveFishNetSkill, resolveFishNetSkillDisplayName } from "@kar-mi/spirit-vale-tools-skills";

export interface SummonRow {
  /** Stable for the life of the summon, for the view to key its rows by. */
  id: string;
  /** The summon's own object, which its statuses are kept under. */
  objectId: number;
  /** The skill that raised it, without the "Summon" in front: "Skeleton Mage". */
  name: string;
  /** The raising skill's sprite, which names its icon. */
  iconId?: string;
  health?: number;
  maxHealth?: number;
}

/** The player's summons as the overlay shows them, each with its own buffs and debuffs. */
export interface CaptureSummonsState {
  rows: Array<SummonRow & { statuses: FishNetActiveStatus[] }>;
  /** When the statuses' remaining times were read. */
  asOfMs: number;
}

export interface SummonRosterState {
  rows: SummonRow[];
}

interface TrackedSummon {
  connectionId: string;
  objectId: number;
  ownerId?: number;
  skillId?: string;
  health?: number;
  maxHealth?: number;
  /** Order of first sighting, so a row keeps its place as others come and go. */
  order: number;
}

/**
 * Follows every summon in range: who it belongs to, the skill that raised it, and its health.
 *
 * Each summon is an object of its own. Its `SummoningComponent` names the owner (`SummonerSync`,
 * the owner's object id) and the skill (`SummonSkillSync`), and its `HealthComponent` carries its
 * health, all either in the spawn or in later updates, in any order. Object ids only mean anything
 * within one connection, so everything is keyed by both.
 */
export class SummonRoster {
  private readonly summons = new Map<string, TrackedSummon>();
  /** Health seen for objects not yet known to be summons, which their summon fields may follow. */
  private readonly pendingHealth = new Map<string, { health?: number; maxHealth?: number }>();
  private nextOrder = 0;

  /** Returns whether anything about a summon changed. */
  consume(packet: CapturedFishNetPacket): boolean {
    if (packet.packetName === "authenticated" || packet.packetName === "disconnect") return this.forgetConnection(packet.connectionId);
    if (packet.objectId === undefined) return false;
    const key = summonKey(packet.connectionId, packet.objectId);

    if (packet.packetName === "objectDespawn") {
      this.pendingHealth.delete(key);
      return this.summons.delete(key);
    }
    if (packet.packetName === "objectSpawn") {
      // A reused object id is a new object.
      const replaced = this.summons.delete(key);
      this.pendingHealth.delete(key);
      const entries = packet.spawnSyncEntries ?? [];
      const records = decodeCharacterSpawnRecords(entries);
      if (records) this.noteHealth(key, records.currentHealth, records.maxHealth);
      const summoned = this.noteSummon(key, packet, entryValue(entries, "SummonerSync", "SummonerSync"), entryValue(entries, "SummonSkillSync", "SkillId"));
      return replaced || summoned;
    }
    if (packet.packetName !== "syncType") return false;

    let changed = false;
    if (packet.networkBehaviourType === "SummoningComponent") {
      const owner = entryValue(packet.syncEntries ?? [], "SummonerSync", "SummonerSync")
        ?? packet.decodedFields?.find((field) => field.name === "SummonerSync")?.value;
      const skill = entryValue(packet.syncEntries ?? [], "SummonSkillSync", "SkillId");
      changed = this.noteSummon(key, packet, owner, skill);
    }
    if (packet.networkBehaviourType === "HealthComponent") {
      const record = decodeCharacterRecordSync(packet);
      if (record) changed = this.noteHealth(key, record.currentHealth, record.maxHealth) || changed;
    }
    return changed;
  }

  /** The summons belonging to one object on one connection, in the order they were raised. */
  state(connectionId: string | undefined, ownerId: number | undefined): SummonRosterState {
    if (connectionId === undefined || ownerId === undefined) return { rows: [] };
    const rows = [...this.summons.values()]
      .filter((summon) => summon.connectionId === connectionId && summon.ownerId === ownerId && summon.skillId !== undefined)
      .sort((left, right) => left.order - right.order)
      .map((summon) => {
        const iconId = resolveFishNetSkill(summon.skillId)?.spriteId;
        return {
        id: summonKey(summon.connectionId, summon.objectId),
        objectId: summon.objectId,
        name: summonName(summon.skillId!),
        ...(iconId === undefined ? {} : { iconId }),
        ...(summon.health === undefined ? {} : { health: summon.health }),
        ...(summon.maxHealth === undefined ? {} : { maxHealth: summon.maxHealth }),
        };
      });
    return { rows };
  }

  /**
   * Whether an object is someone's summon, and whose. A Reanimation is a monster raised by a
   * necromancer and still carries that monster's identity, bosses included, so this is what tells
   * it apart from the real thing.
   */
  summon(connectionId: string | undefined, objectId: number): { ownerId?: number } | undefined {
    if (connectionId === undefined) return undefined;
    const summon = this.summons.get(summonKey(connectionId, objectId));
    if (!summon) return undefined;
    return summon.ownerId === undefined ? {} : { ownerId: summon.ownerId };
  }

  reset(): void {
    this.summons.clear();
    this.pendingHealth.clear();
  }

  private noteSummon(key: string, packet: CapturedFishNetPacket, owner: unknown, skill: unknown): boolean {
    if (typeof owner !== "number" && typeof skill !== "string") return false;
    let summon = this.summons.get(key);
    let changed = false;
    if (!summon) {
      const pending = this.pendingHealth.get(key);
      this.pendingHealth.delete(key);
      summon = { connectionId: packet.connectionId, objectId: packet.objectId!, order: this.nextOrder++, ...pending };
      this.summons.set(key, summon);
      changed = true;
    }
    if (typeof owner === "number" && summon.ownerId !== owner) { summon.ownerId = owner; changed = true; }
    if (typeof skill === "string" && summon.skillId !== skill) { summon.skillId = skill; changed = true; }
    return changed;
  }

  private noteHealth(key: string, health: number | undefined, maxHealth: number | undefined): boolean {
    const summon = this.summons.get(key);
    if (!summon) {
      const pending = this.pendingHealth.get(key) ?? {};
      if (health !== undefined) pending.health = health;
      if (maxHealth !== undefined) pending.maxHealth = maxHealth;
      this.pendingHealth.set(key, pending);
      // Everything with health passes through here; keep the waiting room from growing without end.
      if (this.pendingHealth.size > 4_096) this.pendingHealth.delete(this.pendingHealth.keys().next().value!);
      return false;
    }
    let changed = false;
    if (health !== undefined && summon.health !== health) { summon.health = health; changed = true; }
    if (maxHealth !== undefined && summon.maxHealth !== maxHealth) { summon.maxHealth = maxHealth; changed = true; }
    return changed;
  }

  private forgetConnection(connectionId: string): boolean {
    let changed = false;
    for (const [key, summon] of this.summons) {
      if (summon.connectionId !== connectionId) continue;
      this.summons.delete(key);
      changed = true;
    }
    for (const key of [...this.pendingHealth.keys()]) if (key.startsWith(`${connectionId}\u0000`)) this.pendingHealth.delete(key);
    return changed;
  }
}

function summonKey(connectionId: string, objectId: number): string {
  return `${connectionId}\u0000${objectId}`;
}

function entryValue(entries: ReadonlyArray<{ name: string; fields: ReadonlyArray<{ name: string; value: unknown }> }>, entry: string, field: string): unknown {
  return entries.find((candidate) => candidate.name === entry)?.fields.find((candidate) => candidate.name === field)?.value;
}

/** "Summon Skeleton Mage" reads "Skeleton Mage"; a skill with no catalog entry keeps its id, spaced out. */
export function summonName(skillId: string): string {
  const display = resolveFishNetSkillDisplayName(skillId) ?? skillId.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return display.replace(/^Summon\s+/i, "");
}

export type { FishNetSpawnSyncEntry };
