import type { DecodedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
import type { FishNetLootDrop } from "@kar-mi/spirit-vale-tools-rewards";

/** A Steam ID64, which is how `AccountData` names the platform account. */
const PLATFORM_ACCOUNT_PATTERN = /7656119\d{10}/;

/** What a lock's owner looks like, reported without recording whose it is. */
export type LootLockShape = "platform-account" | "guid" | "number" | "text";

/**
 * Tells the local player's drops from the ones locked to someone else.
 *
 * A drop's lock names a player and, in a party, the party. Which of the player's identifiers the
 * lock uses is not documented, so every one known is tried, and nothing is hidden until a drop has
 * actually matched one: an unrecognised lock format leaves every drop showing, as before. A drop
 * locked to a party is only hidden once the player's own party is known to be a different one.
 */
export class LootOwnership {
  private readonly accountIds = new Set<string>();
  private confirmed = false;
  private partyId: number | undefined;
  private shape: LootLockShape | undefined;

  /** True once a drop has matched the local player, which is when other players' drops start being hidden. */
  get isConfirmed(): boolean { return this.confirmed; }

  /** The owner format seen on locks so far, for diagnosing a filter that never engages. */
  get lockShape(): LootLockShape | undefined { return this.shape; }

  /** Learns the platform account from the login's `CompleteAccountCallback`, where it is listed first. */
  observe(packet: DecodedFishNetPacket): void {
    if (packet.rpcName !== "CompleteAccountCallback") return;
    const accountId = PLATFORM_ACCOUNT_PATTERN.exec(packet.payload.toString("latin1"))?.[0];
    if (accountId !== undefined) this.accountIds.add(accountId);
  }

  /** Whether the drop should be shown to the local player, known here by `identifiers`. */
  isLootable(drop: Pick<FishNetLootDrop, "playerId" | "partyId">, identifiers: readonly (string | undefined)[]): boolean {
    const owner = drop.playerId?.trim();
    const party = drop.partyId !== undefined && drop.partyId > 0 ? drop.partyId : undefined;
    if (!owner) return true;
    this.shape ??= lockShapeOf(owner);

    const mine = this.accountIds.has(owner)
      || identifiers.some((identifier) => identifier !== undefined && identifier.trim() === owner);
    if (mine) {
      this.confirmed = true;
      if (party !== undefined) this.partyId = party;
      return true;
    }
    if (!this.confirmed) return true;
    if (party === undefined) return false;
    return this.partyId === undefined || this.partyId === party;
  }
}

function lockShapeOf(owner: string): LootLockShape {
  if (/^7656119\d{10}$/.test(owner)) return "platform-account";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) return "guid";
  if (/^-?\d+$/.test(owner)) return "number";
  return "text";
}
