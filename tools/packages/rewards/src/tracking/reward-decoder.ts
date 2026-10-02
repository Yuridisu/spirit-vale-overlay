import { FishNetProtocolError } from "@kar-mi/spirit-vale-tools-capture";
import { checkedEnd, readUnsignedPackedWhole, requireBytes } from "@kar-mi/spirit-vale-tools-capture/wire-reader";
import type { DecodedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";

export interface ExperienceCoinsState {
  experience: number;
  level: number;
  jobExperience: number;
  jobLevel: number;
  coins: bigint;
}

export type RewardItemCategory = "equipment" | "artifact" | "card" | "gem" | "material" | "consumable" | "cosmetic" | "currency";

export interface RewardItem {
  category: RewardItemCategory;
  itemId: string;
  count: number;
}

/** One rolled substat as the server sent it: a stat type and the 0-100 roll within that stat's range. */
export interface PickedUpSubstat {
  type: number;
  roll: number;
  /** `StatData.ValueStr`, scoping the stat to one skill or element. */
  qualifier?: string;
}

/** An equipment instance the player picked up, with the rolls that make it unique. */
export interface PickedUpEquipment {
  itemId: string;
  refine: number;
  substats: PickedUpSubstat[];
}

/** An artifact instance the player picked up. `slot` indexes Rune, Jewel, Scroll, Relic. */
export interface PickedUpArtifact {
  itemId: string;
  slot: number;
  refine: number;
  substats: PickedUpSubstat[];
}

export type DecodedRewardPacket =
  | { kind: "experienceState"; tick: number; state: ExperienceCoinsState }
  | { kind: "pickup"; tick: number; items: RewardItem[]; equipment: PickedUpEquipment[]; artifacts: PickedUpArtifact[] };

export function decodeFishNetRewardPacket(packet: DecodedFishNetPacket): DecodedRewardPacket | undefined {
  if (packet.rpcName === "ExpCoinsChanged_T") {
    const reader = new RewardReader(packet.payload);
    const state: ExperienceCoinsState = {
      experience: reader.int32(),
      level: reader.int32(),
      jobExperience: reader.int32(),
      jobLevel: reader.int32(),
      coins: reader.int64(),
    };
    reader.finish(packet.rpcName);
    return { kind: "experienceState", tick: packet.tick, state };
  }
  if (packet.rpcName === "PickupItems_T") {
    const reader = new RewardReader(packet.payload);
    const items = reader.pickupList();
    reader.finish(packet.rpcName);
    return { kind: "pickup", tick: packet.tick, items, equipment: reader.equipment, artifacts: reader.artifacts };
  }
  return undefined;
}

class RewardReader {
  private offset = 0;
  /** Equipment instances read so far, kept apart from the coalesced item counts. */
  readonly equipment: PickedUpEquipment[] = [];
  readonly artifacts: PickedUpArtifact[] = [];

  constructor(private readonly buffer: Buffer) {}

  finish(name: string): void {
    if (this.offset !== this.buffer.length) {
      throw new FishNetProtocolError(`${name} left ${this.buffer.length - this.offset} undecoded bytes at byte ${this.offset}`);
    }
  }

  int32(): number {
    const value = this.signedPacked();
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < -0x8000_0000 || number > 0x7fff_ffff) {
      throw new FishNetProtocolError("reward int32 exceeds its wire range");
    }
    return number;
  }

  int64(): bigint { return this.signedPacked(); }

  boolean(): boolean {
    requireBytes(this.buffer, this.offset, 1, "reward boolean");
    const value = this.buffer[this.offset] ?? 0;
    this.offset += 1;
    if (value !== 0 && value !== 1) throw new FishNetProtocolError(`invalid reward boolean ${value}`);
    return value === 1;
  }

  string(): string | null {
    const length = this.int32();
    if (length === -1) return null;
    if (length < -1) throw new FishNetProtocolError(`invalid reward string length ${length}`);
    const end = checkedEnd(this.buffer, this.offset, length);
    const value = this.buffer.toString("utf8", this.offset, end);
    this.offset = end;
    return value;
  }

  pickupList(): RewardItem[] {
    if (this.boolean()) return [];
    const items: RewardItem[] = [];
    this.list(() => {
      if (this.boolean()) return;
      const type = this.int32();
      const value = this.int64();
      if (value > 0n) items.push({ category: "currency", itemId: `currency:${type}`, count: safeCount(value) });
    });
    this.dictionary("equipment", () => this.equipmentItem(), items);
    this.dictionary("artifact", () => this.artifactItem(), items);
    this.dictionary("card", () => this.stackable(), items);
    this.dictionary("gem", () => this.refinable(), items);
    this.dictionary("material", () => this.stackable(), items);
    this.dictionary("consumable", () => this.stackable(), items);
    this.dictionary("cosmetic", () => this.cosmetic(), items);
    return coalesce(items);
  }

  private dictionary(category: Exclude<RewardItemCategory, "currency">, read: () => { id: string | null; count: number }, items: RewardItem[]): void {
    this.list(() => {
      this.string(); // Dictionary key is the inventory UID, not the public item ID.
      const value = read();
      if (value.id && value.count > 0) items.push({ category, itemId: value.id, count: value.count });
    });
  }

  private inventoryBase(): { id: string | null } {
    return { id: this.string() };
  }

  private stackable(): { id: string | null; count: number } {
    if (this.boolean()) return { id: null, count: 0 };
    const count = this.int32();
    const { id } = this.inventoryBase();
    this.boolean();
    return { id, count };
  }

  private refinable(): { id: string | null; count: number } {
    if (this.boolean()) return { id: null, count: 0 };
    this.string(); // UID
    this.int32(); // refine
    const { id } = this.inventoryBase();
    this.boolean();
    return { id, count: 1 };
  }

  private equipmentItem(): { id: string | null; count: number } {
    if (this.boolean()) return { id: null, count: 0 };
    const substats: PickedUpSubstat[] = [];
    this.list(() => {
      const substat = this.stat();
      if (substat) substats.push(substat);
    });
    this.list(() => this.string()); // Cards
    this.int32(); // StartingPotential
    this.int32(); // SpentPotential
    this.int32(); // ChaosType
    this.string(); // UID
    const refine = this.int32();
    const { id } = this.inventoryBase();
    this.boolean();
    if (id) this.equipment.push({ itemId: id, refine, substats });
    return { id, count: 1 };
  }

  private artifactItem(): { id: string | null; count: number } {
    if (this.boolean()) return { id: null, count: 0 };
    const substats: PickedUpSubstat[] = [];
    this.list(() => {
      const substat = this.stat();
      if (substat) substats.push(substat);
    });
    const slot = this.int32();
    this.list(() => this.string()); // Gems
    this.string(); // UID
    const refine = this.int32();
    const { id } = this.inventoryBase();
    this.boolean();
    if (id) this.artifacts.push({ itemId: id, slot, refine, substats });
    return { id, count: 1 };
  }

  private cosmetic(): { id: string | null; count: number } {
    if (this.boolean()) return { id: null, count: 0 };
    this.int32();
    this.boolean();
    this.string();
    this.int32();
    const { id } = this.inventoryBase();
    this.boolean();
    return { id, count: 1 };
  }

  private stat(): PickedUpSubstat | undefined {
    if (this.boolean()) return undefined;
    const type = this.int32();
    const roll = this.int32();
    const qualifier = this.string();
    return { type, roll, ...(qualifier ? { qualifier } : {}) };
  }

  private list(read: () => void): void {
    const count = this.int64();
    if (count === -1n) return;
    if (count < -1n || count > 1_000_000n) throw new FishNetProtocolError(`invalid reward collection count ${count}`);
    for (let index = 0; index < Number(count); index += 1) read();
  }

  private signedPacked(): bigint {
    const decoded = readUnsignedPackedWhole(this.buffer, this.offset);
    this.offset = decoded.nextOffset;
    return (decoded.value >> 1n) ^ -(decoded.value & 1n);
  }
}

function safeCount(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new FishNetProtocolError("reward count exceeds safe integer range");
  return Number(value);
}

function coalesce(items: RewardItem[]): RewardItem[] {
  const totals = new Map<string, RewardItem>();
  for (const item of items) {
    const key = `${item.category}|${item.itemId}`;
    const previous = totals.get(key);
    if (previous) previous.count += item.count;
    else totals.set(key, { ...item });
  }
  return [...totals.values()];
}
