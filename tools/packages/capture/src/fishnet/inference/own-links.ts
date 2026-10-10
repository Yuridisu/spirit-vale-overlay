import { decodeFieldRun, tryDecodeFields } from "../decoding/fields.ts";
import type { NetworkTransformAxes } from "../decoding/network-transform.ts";
import type { RpcLinkRegistrationState } from "../decoding/protocol.ts";
import type { FishNetRpcDefinition, FishNetRpcMap } from "../types.ts";

/**
 * The local player's own object arrives without RPC Link registrations: the server spawns it for
 * its owner with an empty link segment, yet sends the hits and heals on it through links. Every
 * other player's copy of the same prefab carries all of them, so the gap is only ever the local
 * player's, and every hit on them was lost.
 *
 * The local client tells us which objects are its own (it sends their transforms to the server)
 * and where they are. An unregistered link whose payload is exactly a `HealthComponent.ApplyDamage_C`,
 * dealt by someone else's side, landing where one of those objects stands, is a hit on it. After a
 * second such hit the link is bound to that object, and decodes like any registered link from then on.
 *
 * The same goes for the RPCs the server sends the player alone, on the components only the player's
 * own object has (PlayerController, PlayerSave): the channel list that says which channel they are
 * on is one. An unregistered link whose payload fits exactly one RPC in the whole map, and that one
 * is such a target RPC, is bound to the own object's component.
 */

/** How close, on the ground plane, a hit must land to the player's own position to be theirs. */
const OWN_HIT_RADIUS = 4;
/** Hits one link must land near the same own object before it is bound to it. */
const OWN_HIT_CORROBORATION = 2;
const HEALTH_COMPONENT = "HealthComponent";
/** Behaviours on the player's own object alone; their target RPCs only ever go to their owner. */
const OWN_ONLY_BEHAVIOURS = new Set(["PlayerController", "PlayerSave"]);
/** Payloads one unregistered link may be tried against the whole map before it is left alone. */
const TARGET_LINK_ATTEMPTS = 40;
const APPLY_DAMAGE = "ApplyDamage_C";

export interface OwnObjectState {
  /** Objects the local client moves itself, by the transforms it sends, with their last position. */
  ownPositions: Map<number, NetworkTransformAxes>;
  /** Unregistered links that have landed hits near an own object, waiting to be bound. */
  pendingOwnLinks: Map<number, { objectId: number; hits: number }>;
  /** How many payloads each unregistered link has been tried against the map's target RPCs. */
  targetLinkAttempts: Map<number, number>;
  components: ReadonlyMap<string, string>;
  staleComponents: ReadonlyMap<string, string>;
}

const damageRpcs = new WeakMap<FishNetRpcMap, FishNetRpcDefinition | null>();

function healthDamageRpc(map: FishNetRpcMap): FishNetRpcDefinition | undefined {
  let rpc = damageRpcs.get(map);
  if (rpc === undefined) {
    rpc = map.behaviours.find(({ typeName }) => typeName === HEALTH_COMPONENT)?.rpcs
      .find(({ methodName, packetKind }) => methodName === APPLY_DAMAGE && packetKind === "observersRpc") ?? null;
    damageRpcs.set(map, rpc);
  }
  return rpc ?? undefined;
}

/** Records where an object the local client moves itself now stands. */
export function noteOwnTransform(state: OwnObjectState, objectId: number, position: NetworkTransformAxes): void {
  const previous = state.ownPositions.get(objectId) ?? {};
  state.ownPositions.set(objectId, {
    x: position.x ?? previous.x,
    y: position.y ?? previous.y,
    z: position.z ?? previous.z,
  });
}

/** Forgets an object id the server has handed to a new spawn. */
export function forgetOwnObject(state: OwnObjectState, objectId: number): void {
  state.ownPositions.delete(objectId);
  for (const [linkId, pending] of state.pendingOwnLinks) {
    if (pending.objectId === objectId) state.pendingOwnLinks.delete(linkId);
  }
}

function componentIndex(state: OwnObjectState, objectId: number, behaviour: string): number | undefined {
  const prefix = `${objectId}:`;
  for (const components of [state.components, state.staleComponents]) {
    for (const [key, typeName] of components) {
      if (typeName === behaviour && key.startsWith(prefix)) return Number(key.slice(prefix.length));
    }
  }
  return undefined;
}

const healthComponentIndex = (state: OwnObjectState, objectId: number) => componentIndex(state, objectId, HEALTH_COMPONENT);

interface RpcCandidate { typeName: string; rpc: FishNetRpcDefinition }
const linkableRpcs = new WeakMap<FishNetRpcMap, RpcCandidate[]>();

/** Every RPC a link can carry whose payload can be checked, once per map. */
function checkableRpcs(map: FishNetRpcMap): RpcCandidate[] {
  let list = linkableRpcs.get(map);
  if (!list) {
    list = map.behaviours.flatMap(({ typeName, rpcs }) => rpcs
      .filter((rpc) => (rpc.packetKind === "targetRpc" || rpc.packetKind === "observersRpc")
        && (rpc.parameters?.length ?? 0) > 0
        && !tryDecodeFields(Buffer.alloc(0), rpc.parameters).undecodable)
      .map((rpc) => ({ typeName, rpc })));
    linkableRpcs.set(map, list);
  }
  return list;
}

/**
 * The registration for an unregistered link carrying a target RPC to the player's own object: its
 * payload fits that RPC and no other in the map. Undefined for anything that fits none or several.
 */
export function recoverOwnTargetLink(
  map: FishNetRpcMap | undefined,
  state: OwnObjectState,
  linkId: number,
  payload: Buffer,
): RpcLinkRegistrationState | undefined {
  if (!map || state.ownPositions.size === 0 || payload.length === 0) return undefined;
  const attempts = state.targetLinkAttempts.get(linkId) ?? 0;
  if (attempts >= TARGET_LINK_ATTEMPTS) return undefined;
  state.targetLinkAttempts.set(linkId, attempts + 1);
  const fits = checkableRpcs(map).filter(({ rpc }) => {
    const fit = tryDecodeFields(payload, rpc.parameters);
    // A signature known only up to a point (a field the game added since) fits a longer payload.
    return fit.complete && (fit.consumed === payload.length || (rpc.parameters?.at(-1)?.prefix === true && fit.consumed < payload.length));
  });
  if (fits.length !== 1) return undefined;
  const [{ typeName, rpc }] = fits as [RpcCandidate];
  if (rpc.packetKind !== "targetRpc" || !OWN_ONLY_BEHAVIOURS.has(typeName)) return undefined;
  const owners = [...state.ownPositions.keys()].flatMap((objectId) => {
    const index = componentIndex(state, objectId, typeName);
    return index === undefined ? [] : [{ objectId, index }];
  });
  if (owners.length !== 1) return undefined;
  const [owner] = owners as [{ objectId: number; index: number }];
  state.targetLinkAttempts.delete(linkId);
  return { objectId: owner.objectId, componentIndex: owner.index, rpcHash: rpc.wireHash, packetName: "targetRpc", networkBehaviourType: typeName };
}

/**
 * The registration for an unregistered link that carries hits on the local player's own object,
 * once it has landed enough of them there; undefined until then, or when the payload is anything else.
 */
export function recoverOwnDamageLink(
  map: FishNetRpcMap | undefined,
  state: OwnObjectState,
  linkId: number,
  payload: Buffer,
): RpcLinkRegistrationState | undefined {
  if (!map || state.ownPositions.size === 0) return undefined;
  const rpc = healthDamageRpc(map);
  if (!rpc) return undefined;
  const run = decodeFieldRun(payload, rpc.parameters);
  if (!run.complete || run.consumed !== payload.length) return undefined;
  const value = (name: string) => run.fields.find((field) => field.name === name)?.value;
  const team = value("dmg.Team");
  const attacker = value("dmg.AttackerId");
  const position = value("position");
  // The player's own side (team 0) deals the hits that land on monsters; the player's own hits are never on them.
  if (typeof team !== "number" || team === 0 || typeof attacker !== "number" || state.ownPositions.has(attacker)) return undefined;
  if (!Array.isArray(position) || typeof position[0] !== "number" || typeof position[2] !== "number") return undefined;

  const near: Array<{ objectId: number; componentIndex: number }> = [];
  for (const [objectId, own] of state.ownPositions) {
    if (own.x === undefined || own.z === undefined) continue;
    if (Math.hypot(position[0] - own.x, position[2] - own.z) > OWN_HIT_RADIUS) continue;
    const componentIndex = healthComponentIndex(state, objectId);
    if (componentIndex !== undefined) near.push({ objectId, componentIndex });
  }
  if (near.length !== 1) return undefined;
  const [target] = near as [{ objectId: number; componentIndex: number }];

  const pending = state.pendingOwnLinks.get(linkId);
  const hits = pending?.objectId === target.objectId ? pending.hits + 1 : 1;
  if (hits < OWN_HIT_CORROBORATION) {
    state.pendingOwnLinks.set(linkId, { objectId: target.objectId, hits });
    return undefined;
  }
  state.pendingOwnLinks.delete(linkId);
  return {
    objectId: target.objectId,
    componentIndex: target.componentIndex,
    rpcHash: rpc.wireHash,
    packetName: "observersRpc",
    networkBehaviourType: HEALTH_COMPONENT,
  };
}
