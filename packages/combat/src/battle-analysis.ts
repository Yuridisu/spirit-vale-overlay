/**
 * Battle Analysis: where your damage comes from and how much of it each piece of gear is worth.
 *
 * The game sends only the final number of every hit (with its skill, element, damage type, hit
 * result and whether a clone dealt it), never how it was computed. So every figure is labelled:
 *  - measured: read straight off the hits (damage per skill, autocasts, elements, clones, the
 *    extra hits of Multistrike);
 *  - split: a measured amount shared between the items that can cause it, by their chances (two
 *    Stormcall Kunai both autocast Chain Lightning, and the game does not say which one did);
 *  - estimated: a percent bonus's share of the damage it applies to, value / (100 + total of that
 *    bonus), assuming bonuses of one kind add up and different kinds multiply.
 * Flat ATK / MATK, attack speed, crit and the like cannot be pulled out of a hit; the Sets view
 * compares damage per second between gear sets instead.
 *
 * Tank and Support read the other side: the hits aimed at the player (what landed, what was missed,
 * dodged or blocked, by type, element and attacker), what the player reflected, and the heals and
 * shields the player cast, on whom and per second.
 *
 * Pure: the caller feeds it the player's own events and character snapshot; resolvers are injected.
 * Ported from the analysis written for Spiritvale Companion 2.0.
 */
import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";

/** The game's element numbers. 0, 1, 3, 4, 5, 6 and 8 are confirmed by skills and statuses. */
export const ELEMENT_NAMES: Record<number, string> = {
  0: "Neutral", 1: "Poison", 2: "Earth", 3: "Shadow", 4: "Fire", 5: "Water", 6: "Wind", 7: "Holy", 8: "Undead", 9: "Ghost",
};

/** ApplyDamage_C damage types seen in captures: 0 is a plain attack (physical), 4 reflected damage. */
export const DAMAGE_TYPES = { PLAIN: 0, MAGIC: 1, PHYSICAL: 2, STATUS: 3, REFLECT: 4 } as const;

const STAT = {
  AUTOCAST_ON_HIT: 39,
  AUTOCAST_ON_ATTACK: 40,
  ELEMENT_DAMAGE: 46,
  MAGIC_DAMAGE: 48,
  SKILL_DAMAGE: 49,
  MULTISTRIKE: 80,
  ATK_MULTIPLIER: 69,
  MATK_MULTIPLIER: 70,
  ELEMENT_RESISTANCE: 53,
  DAMAGE_FROM_MAGIC: 57,
  DAMAGE_FROM_MELEE: 58,
  HEALING: 67,
  BLOCK: 85,
  REFLECT_DAMAGE: 86,
  SPELL_REFLECT: 94,
} as const;

/** Hits closer together than this count as one stretch of fighting for damage per second. */
const ACTIVE_GAP_MS = 3_000;
/** Tank and Support count time in combat: any hit dealt or taken, heal or shield, this close together. */
const ENGAGED_GAP_MS = 5_000;
const REFLECT = "reflect";
/** Recovery that is the player's own sustain, not support: regeneration and leech. */
const SELF_SUSTAIN = new Set(["passive-regeneration", "drain"]);
const MAX_SETS = 12;
const BASIC_ATTACK = "Basic Attack";
const ITEM_TYPE = { EQUIPMENT: 2, ARTIFACT: 3, CARD: 4, GEM: 5 } as const;

/** The fields of a logged combat event this analysis reads. */
export interface BattleEvent {
  kind: string;
  rpc?: string;
  tick?: number;
  actorId?: number;
  targetId?: number;
  team?: number;
  value?: number;
  sourceId?: string;
  sourceLabel?: string;
  hitResult?: string | number;
  element?: number;
  damageType?: number;
  isClone?: boolean;
  level?: number;
  duplicatesDamageEvent?: boolean;
  /** Heals: "standard", "passive-regeneration", "drain". */
  recoveryStyle?: string;
  /** Shields: "gained" or "absorbed". */
  action?: string;
}

interface ItemEffect { type: number; value: number; target?: { kind: string; id: string } }
interface ItemDefinition { displayName?: string; effects?: readonly ItemEffect[]; refineEffects?: readonly ItemEffect[] }
interface SkillDefinition { displayName?: string; effects?: readonly { label?: string }[] }
export type ItemResolver = (itemType: number, itemId: string) => ItemDefinition | undefined | null;
/** A player's or monster's name by actor id, from the identities seen. */
export type NameResolver = (actorId: number) => string | undefined;
export type SkillResolver = (skillId: string) => SkillDefinition | undefined | null;
export type SubstatRescaler = (snapshot: CharacterSnapshot) => CharacterSnapshot;

export type BattlePartKind = "measured" | "split" | "estimated";

/** A skill's damage from spiritvalers.com: `base + perLevel × level` percent of ATK or MATK. */
export interface SkillFormula {
  base: number;
  perLevel: number;
  /** The site's name for it ("Meteor"), to find it when the game's id differs. */
  name?: string;
}

/**
 * One stat the player could raise next and what it would add, as a share of damage per second.
 * Estimated: bonuses of one kind add up and different kinds multiply, so +1% is worth
 * share / (100 + the bonus already held); flat ATK or MATK is worth its share of the total.
 */
export interface BattleAdviceRow {
  key: string;
  label: string;
  /** Damage per second gained, as a fraction (0.004 = +0.4%). */
  gain: number;
  /** What the player holds of it now, from gear. */
  now: string;
  /**
   * "percent" bonuses are ranked against each other (the best one is marked); a "flat" amount is
   * not comparable to a percent, so it is given as what percent of MATK or ATK it equals.
   */
  kind: "percent" | "flat";
  /** For a flat amount: the percent of MATK or ATK it is worth as much as. */
  equalsPercent?: number;
  best: boolean;
}

export interface BattleSourceRow {
  id: string;
  label: string;
  damage: number;
  share: number;
  dps: number;
  hits: number;
  critRate: number;
  cloneShare: number;
  autocasts: number;
  casts: number;
  autocastShare?: number;
  autocastLevels: Array<{ level: number; count: number }>;
  element?: string;
  multistrike?: { extraHits: number; damage: number };
  /** The skill's damage formula at the learned level, when spiritvalers.com has it. */
  formula?: { level: number; percent: number; scales: "MATK" | "ATK" };
}

/** One line of a breakdown: an attacker, a healer, a heal target or a heal skill. */
export interface BattleShareRow {
  key: string;
  label: string;
  amount: number;
  share: number;
  perSec: number;
  count: number;
  /** Shields, for heal targets and skills. */
  shields?: number;
  /** The player themself. */
  self?: boolean;
  /** Its biggest parts ("Fire Breath 60%"). */
  parts: string[];
}

/** Damage the player took, how much was avoided, what was reflected, and what to raise against it. */
export interface BattleTankView {
  taken: number;
  activeSec: number;
  dtps: number;
  /** Hits aimed at the player, and how they ended. */
  attempts: number;
  landed: number;
  crits: number;
  critDamage: number;
  missed: number;
  dodged: number;
  blocked: number;
  types: Array<{ name: string; damage: number; share: number }>;
  elements: Array<{ name: string; damage: number; share: number }>;
  attackers: BattleShareRow[];
  /** Taken out of the player's shields instead of their health. */
  absorbed: number;
  received: number;
  receivedPerSec: number;
  healers: BattleShareRow[];
  reflect: { damage: number; perSec: number; hits: number; gear: string[] };
  /** Defences to raise next, best first; estimated like the damage advice. */
  advice: BattleAdviceRow[];
}

/** The heals and shields the player cast: on whom, with what, and per second. */
export interface BattleSupportView {
  healing: number;
  shields: number;
  /** Heals and shields on anyone but the player. */
  toAllies: number;
  activeSec: number;
  hps: number;
  allyHps: number;
  count: number;
  targets: BattleShareRow[];
  skills: BattleShareRow[];
  /** Healing % from gear, and the share of healing +1% more would add. */
  healingBonus: number;
  healingGain?: number;
}

export interface BattleItemPart {
  label: string;
  detail: string;
  damage: number;
  kind: BattlePartKind;
  note: string;
  upTo?: boolean;
}

export interface BattleItemRow {
  key: string;
  slot: string;
  name: string;
  refine: number;
  damage: number;
  share: number;
  parts: BattleItemPart[];
  unmeasured: string[];
}

export interface BattleSetRow {
  key: string;
  current: boolean;
  items: string[];
  damage: number;
  activeSec: number;
  dps: number;
  /** Damage taken and healing cast per second in combat with this set; 0 when there was none. */
  dtps: number;
  hps: number;
  lastAt: number;
  top: Array<{ label: string; share: number }>;
}

export interface BattleAnalysisView {
  revision: number;
  startedAt: number;
  damage: number;
  activeSec: number;
  dps: number;
  cloneShare: number;
  hasGear: boolean;
  /** Stats to raise next, best first; empty until there is damage and gear to judge by. */
  advice: BattleAdviceRow[];
  sources: BattleSourceRow[];
  elements: Array<{ name: string; damage: number; share: number }>;
  items: BattleItemRow[];
  sets: BattleSetRow[];
  tank: BattleTankView;
  support: BattleSupportView;
}

/** A gear set's totals, as saved between runs. */
export interface BattleSetRecord {
  key: string;
  items: string[];
  damage: number;
  activeMs: number;
  firstAt: number;
  lastAt: number;
  sources: Record<string, number>;
  /** Damage taken, healing cast, and time in combat with this set. */
  taken?: number;
  healing?: number;
  engagedMs?: number;
}

interface Owner { key: string; slot: string; name: string; refine: number }
interface GearLine { owner: Owner; via: string | null; type: number; value: number; target: { kind: string; id: string } | null }

interface SourceTally {
  id: string;
  label: string;
  damage: number;
  hits: number;
  crits: number;
  cloneDamage: number;
  autocasts: number;
  casts: number;
  autocastLevels: Map<number, number>;
  elements: Map<string, number>;
  types: Map<number, number>;
}

/** A breakdown line while it is counted: an amount, how many times, and what it was made of. */
interface ShareTally {
  label: string;
  amount: number;
  count: number;
  shields: number;
  self: boolean;
  parts: Map<string, number>;
}

interface TakenTally {
  damage: number;
  attempts: number;
  landed: number;
  crits: number;
  critDamage: number;
  missed: number;
  dodged: number;
  blocked: number;
  physicalAttempts: number;
  physicalLanded: number;
  types: Map<string, number>;
  elements: Map<string, number>;
  attackers: Map<string, ShareTally>;
  absorbed: number;
  received: number;
  healers: Map<string, ShareTally>;
}

interface SupportTally {
  healing: number;
  shields: number;
  toAllies: number;
  count: number;
  targets: Map<string, ShareTally>;
  skills: Map<string, ShareTally>;
}

interface Session {
  startedAt: number;
  damage: number;
  activeMs: number;
  lastHitAt?: number;
  engagedMs: number;
  lastEngagedAt?: number;
  taken: TakenTally;
  support: SupportTally;
  sources: Map<string, SourceTally>;
  elements: Map<string, number>;
  types: Map<number, number>;
  cloneDamage: number;
  multistrike: { extraHits: number; damage: number };
  lastBasic?: string;
}

const num = (value: unknown): number => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const bump = <K>(map: Map<K, number>, key: K, by: number): void => { map.set(key, (map.get(key) ?? 0) + by); };

/** "Wind" from a target or qualifier, case-insensitive; undefined when it is not an element. */
function elementOf(id: unknown): string | undefined {
  const key = String(id ?? "").toLowerCase();
  return Object.values(ELEMENT_NAMES).find((name) => name.toLowerCase() === key);
}

function newSession(nowMs: number): Session {
  return {
    startedAt: nowMs, damage: 0, activeMs: 0, sources: new Map(), elements: new Map(), types: new Map(), cloneDamage: 0, multistrike: { extraHits: 0, damage: 0 },
    engagedMs: 0,
    taken: { damage: 0, attempts: 0, landed: 0, crits: 0, critDamage: 0, missed: 0, dodged: 0, blocked: 0, physicalAttempts: 0, physicalLanded: 0, types: new Map(), elements: new Map(), attackers: new Map(), absorbed: 0, received: 0, healers: new Map() },
    support: { healing: 0, shields: 0, toAllies: 0, count: 0, targets: new Map(), skills: new Map() },
  };
}

function elementName(element: number | undefined): string {
  return element === undefined ? "Unknown" : ELEMENT_NAMES[element] ?? `Element ${element}`;
}

/** The kind of a hit the player took. */
function takenType(event: BattleEvent): string {
  if (event.sourceId === REFLECT || event.damageType === DAMAGE_TYPES.REFLECT) return "Reflected";
  switch (event.damageType) {
    case DAMAGE_TYPES.PLAIN:
    case DAMAGE_TYPES.PHYSICAL: return "Physical";
    case DAMAGE_TYPES.MAGIC: return "Magic";
    case DAMAGE_TYPES.STATUS: return "Status";
    default: return "Unknown";
  }
}

function tally(map: Map<string, ShareTally>, key: string, label: string): ShareTally {
  let row = map.get(key);
  if (!row) {
    row = { label, amount: 0, count: 0, shields: 0, self: false, parts: new Map() };
    map.set(key, row);
  }
  return row;
}

/** Breakdown lines, biggest first, with their share of the total and per second in combat. */
function shareRows(map: Map<string, ShareTally>, total: number, seconds: number): BattleShareRow[] {
  return [...map.entries()]
    .filter(([, row]) => row.amount > 0)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([key, row]) => {
      const parts = [...row.parts.entries()].sort((a, b) => b[1] - a[1]);
      return {
        key,
        label: row.label,
        amount: row.amount,
        share: total > 0 ? row.amount / total : 0,
        perSec: row.amount / seconds,
        count: row.count,
        ...(row.shields ? { shields: row.shields } : {}),
        ...(row.self ? { self: true } : {}),
        parts: parts.length === 1 ? [parts[0]![0]] : parts.slice(0, 3).map(([name, amount]) => `${name} ${Math.round((amount / row.amount) * 100)}%`),
      };
    });
}

const byShare = (map: Map<string, number>, total: number) => [...map.entries()]
  .filter(([name, amount]) => name !== "Unknown" && amount > 0)
  .sort((a, b) => b[1] - a[1])
  .map(([name, damage]) => ({ name, damage, share: total > 0 ? damage / total : 0 }));

/**
 * Every damage-relevant line of the worn gear, one entry per line, with the item it is on. Innate
 * and refine effects come from the item catalog (targets kept: they say which skill or element a
 * bonus is for); rolled lines come from the snapshot, rescaled to values.
 */
export function gearLines(snapshot: CharacterSnapshot | undefined, resolveItem: ItemResolver, rescale?: SubstatRescaler): GearLine[] {
  const lines: GearLine[] = [];
  if (!snapshot) return lines;
  let source = snapshot;
  if (rescale) {
    try { source = rescale(snapshot); } catch { /* keep the raw rolls; lines without a value are skipped */ }
  }
  const resolve = (type: number, id: string): ItemDefinition | undefined => {
    try { return resolveItem(type, id) ?? undefined; } catch { return undefined; }
  };
  const fromCatalog = (owner: Owner, type: number, id: string, refine: number, via: string | null): void => {
    const def = resolve(type, id);
    const add = (effects: readonly ItemEffect[] | undefined, times: number) => {
      for (const effect of effects ?? []) {
        if (!Number.isFinite(Number(effect?.value))) continue;
        lines.push({ owner, via, type: effect.type, value: Number(effect.value) * times, target: effect.target ? { kind: effect.target.kind, id: effect.target.id } : null });
      }
    };
    add(def?.effects, 1);
    if (refine > 0) add(def?.refineEffects, refine);
  };
  const qualified = (qualifier: string | undefined): GearLine["target"] => {
    if (!qualifier) return null;
    const element = elementOf(qualifier);
    return element ? { kind: "element", id: element } : { kind: "skill", id: qualifier };
  };
  source.equipment.forEach((item, index) => {
    if (!item?.itemId) return;
    const def = resolve(ITEM_TYPE.EQUIPMENT, item.itemId);
    const owner: Owner = { key: `${item.slot || "slot"}#${index}`, slot: item.slot || "", name: def?.displayName || item.itemId, refine: num(item.refine) };
    fromCatalog(owner, ITEM_TYPE.EQUIPMENT, item.itemId, num(item.refine), null);
    for (const card of item.cards ?? []) {
      if (!card) continue;
      fromCatalog(owner, ITEM_TYPE.CARD, card, 0, resolve(ITEM_TYPE.CARD, card)?.displayName || card);
    }
    for (const stat of item.substats ?? []) {
      if (!stat || !Number.isFinite(Number(stat.value))) continue;
      lines.push({ owner, via: null, type: stat.type, value: Number(stat.value), target: qualified(stat.qualifier) });
    }
  });
  source.artifacts.forEach((item, index) => {
    if (!item?.itemId) return;
    const def = resolve(ITEM_TYPE.ARTIFACT, item.itemId);
    const owner: Owner = { key: `artifact:${item.slot || index}#${index}`, slot: item.slot || "Artifact", name: def?.displayName || item.itemId, refine: num(item.refine) };
    fromCatalog(owner, ITEM_TYPE.ARTIFACT, item.itemId, num(item.refine), null);
    for (const gem of item.gems ?? []) {
      if (!gem?.id) continue;
      fromCatalog(owner, ITEM_TYPE.GEM, gem.id, num(gem.refine), resolve(ITEM_TYPE.GEM, gem.id)?.displayName || gem.id);
    }
    for (const stat of item.substats ?? []) {
      if (!stat || !Number.isFinite(Number(stat.value))) continue;
      lines.push({ owner, via: null, type: stat.type, value: Number(stat.value), target: qualified(stat.qualifier) });
    }
  });
  return lines;
}

/** A stable key for a gear set: what is worn where, with refine and cards. */
export function loadoutKey(snapshot: CharacterSnapshot | undefined): string | undefined {
  const equipment = snapshot?.equipment ?? [];
  if (!equipment.length) return undefined;
  return equipment
    .filter((item) => item?.itemId)
    .map((item) => `${item.slot}:${item.itemId}+${num(item.refine)}[${(item.cards ?? []).filter(Boolean).join(",")}]`)
    .sort()
    .join("|");
}

/** Lines whose worth cannot be read off hits, named so the player knows what was left out. */
const UNMEASURED: Record<number, string> = {
  9: "ATK", 10: "MATK", 15: "Critical chance", 52: "Critical damage", 63: "Attack speed", 64: "Cast speed",
  69: "ATK multiplier", 70: "MATK multiplier", 0: "STR", 2: "AGI", 3: "DEX", 4: "INT", 5: "LUK",
  45: "Damage to boss", 47: "Melee damage", 102: "Ranged damage", 130: "Auto-attack chain",
};

export class BattleAnalysis {
  private session: Session = newSession(Date.now());
  private snapshot: CharacterSnapshot | undefined;
  private lines: GearLine[] = [];
  private loadout: string | undefined;
  private readonly sets = new Map<string, BattleSetRecord & { lastHitAt?: number; lastEngagedAt?: number }>();
  private formulas = new Map<string, SkillFormula>();
  private attack: { magic?: number; physical?: number } = {};
  revision = 0;

  constructor(private readonly deps: { resolveItem: ItemResolver; resolveSkill?: SkillResolver; rescale?: SubstatRescaler; nameOf?: NameResolver }) {}

  reset(nowMs = Date.now()): void {
    this.session = newSession(nowMs);
    this.revision += 1;
  }

  /** Skill damage formulas by game skill id (FirePillar), from spiritvalers.com. */
  setSkillFormulas(formulas: Record<string, SkillFormula>): void {
    this.formulas = new Map(Object.entries(formulas));
    this.revision += 1;
  }

  /** The character's attack totals (from the stat sheet), for what flat ATK or MATK is worth. */
  setAttack(attack: { magic?: number; physical?: number }): void {
    if (attack.magic === this.attack.magic && attack.physical === this.attack.physical) return;
    this.attack = attack;
    this.revision += 1;
  }

  clearSets(): void {
    this.sets.clear();
    this.revision += 1;
  }

  /** The character snapshot: the gear whose lines are rated and which set the damage counts for. */
  setCharacter(snapshot: CharacterSnapshot | undefined, nowMs = Date.now()): void {
    if (!snapshot?.equipment?.length) return;
    const key = loadoutKey(snapshot);
    if (snapshot === this.snapshot && key === this.loadout) return;
    this.snapshot = snapshot;
    this.lines = gearLines(snapshot, this.deps.resolveItem, this.deps.rescale);
    if (key) {
      this.loadout = key;
      const items = this.loadoutItems(snapshot);
      const set = this.sets.get(key);
      if (set) set.items = items;
      else {
        this.sets.set(key, { key, items, damage: 0, activeMs: 0, firstAt: nowMs, lastAt: nowMs, sources: {} });
        this.pruneSets();
      }
    }
    this.revision += 1;
  }

  /** One of the player's casts: autocasts and casts are counted per skill to split its damage. */
  noteActivation(event: BattleEvent): void {
    if (event.kind !== "activation" || !event.sourceId || event.sourceId.startsWith("__")) return;
    const row = this.sourceRow(event.sourceId, event.sourceLabel);
    if (event.rpc === "AutoCast_C") {
      row.autocasts += 1;
      if (Number.isFinite(event.level)) bump(row.autocastLevels, Number(event.level), 1);
    } else if (event.rpc === "CastBegin_C") {
      // Counted on Begin: instant casts often send no Complete (Ice Release: 6 begins, 1 complete).
      row.casts += 1;
    } else if (event.rpc === "CastCancel_C" || event.rpc === "CastInterrupt_C") {
      row.casts = Math.max(0, row.casts - 1);
    } else return;
    this.revision += 1;
  }

  /** One of the player's hits (or their clone's) on an enemy. */
  noteDamage(event: BattleEvent, nowMs: number): void {
    const value = num(event.value);
    if (value <= 0) return;
    const s = this.session;
    const id = event.sourceId || event.sourceLabel || "Unknown";
    const row = this.sourceRow(id, event.sourceLabel);
    const element = event.element === undefined ? "Unknown" : ELEMENT_NAMES[event.element] ?? `Element ${event.element}`;
    row.damage += value;
    row.hits += 1;
    if (event.hitResult === "critical") row.crits += 1;
    if (event.isClone) { row.cloneDamage += value; s.cloneDamage += value; }
    bump(row.elements, element, value);
    if (event.damageType !== undefined) bump(row.types, num(event.damageType), value);
    s.damage += value;
    bump(s.elements, element, value);
    if (event.damageType !== undefined) bump(s.types, num(event.damageType), value);
    s.activeMs += s.lastHitAt === undefined ? 0 : Math.min(ACTIVE_GAP_MS, Math.max(0, nowMs - s.lastHitAt));
    s.lastHitAt = nowMs;

    // Multistrike: a basic attack lands one packet per target (its hit count already covers dual
    // wield); more packets on the same target in the same tick are the extra strikes.
    if (id === BASIC_ATTACK) {
      const key = `${event.tick}|${event.targetId}|${event.isClone ? 1 : 0}`;
      if (s.lastBasic === key) { s.multistrike.extraHits += 1; s.multistrike.damage += value; }
      s.lastBasic = key;
    }

    const set = this.loadout ? this.sets.get(this.loadout) : undefined;
    if (set) {
      set.damage += value;
      set.activeMs += set.lastHitAt === undefined ? 0 : Math.min(ACTIVE_GAP_MS, Math.max(0, nowMs - set.lastHitAt));
      set.lastHitAt = nowMs;
      set.lastAt = nowMs;
      set.sources[row.label] = (set.sources[row.label] ?? 0) + value;
    }
    this.engage(nowMs);
    this.revision += 1;
  }

  /** A hit someone else aimed at the player, landed or not. */
  noteTaken(event: BattleEvent, nowMs: number): void {
    const t = this.session.taken;
    const value = Math.max(0, num(event.value));
    const result = String(event.hitResult ?? "normal");
    const physical = event.damageType === DAMAGE_TYPES.PLAIN || event.damageType === DAMAGE_TYPES.PHYSICAL;
    t.attempts += 1;
    if (physical) t.physicalAttempts += 1;
    if (result === "miss") t.missed += 1;
    else if (result === "dodged") t.dodged += 1;
    else if (result === "blocked") t.blocked += 1;
    if (value > 0) {
      t.landed += 1;
      if (physical) t.physicalLanded += 1;
      if (result === "critical") { t.crits += 1; t.critDamage += value; }
      t.damage += value;
      bump(t.types, takenType(event), value);
      bump(t.elements, elementName(event.element), value);
      const name = this.nameOf(event.actorId) ?? "Unknown";
      const row = tally(t.attackers, name, name);
      row.amount += value;
      row.count += 1;
      bump(row.parts, event.sourceLabel || event.sourceId || "Unknown", value);
      const set = this.loadout ? this.sets.get(this.loadout) : undefined;
      if (set) set.taken = (set.taken ?? 0) + value;
    }
    this.engage(nowMs);
    this.revision += 1;
  }

  /**
   * A heal or shield the player cast or received. The player's casts count for Support, except
   * their own regeneration and leech; what they received counts for Tank, and a shield taking a hit
   * on them counts as absorbed.
   */
  noteRecovery(event: BattleEvent, nowMs: number, who: { byMe: boolean; toMe: boolean }): void {
    const value = num(event.value);
    if (value <= 0) return;
    const shield = event.kind === "shield";
    if (shield && event.action === "absorbed") {
      if (!who.toMe) return;
      this.session.taken.absorbed += value;
      this.revision += 1;
      return;
    }
    if (shield && event.action !== "gained") return;
    const skill = event.sourceLabel || event.sourceId || (shield ? "Shield" : "Heal");
    if (who.toMe && !shield) {
      const t = this.session.taken;
      const healer = who.byMe ? "You" : this.nameOf(event.actorId) ?? "Not tied to anyone";
      const row = tally(t.healers, who.byMe ? `self:${skill}` : `ally:${healer}`, who.byMe ? `You: ${skill}` : healer);
      row.amount += value;
      row.count += 1;
      if (!who.byMe && event.sourceLabel) bump(row.parts, event.sourceLabel, value);
      t.received += value;
    }
    if (who.byMe && !SELF_SUSTAIN.has(String(event.recoveryStyle ?? ""))) {
      const sp = this.session.support;
      const target = who.toMe ? "You" : this.nameOf(event.targetId) ?? "Unknown";
      for (const row of [tally(sp.targets, who.toMe ? "self" : target, target), tally(sp.skills, skill, skill)]) {
        row.amount += value;
        row.count += 1;
        if (shield) row.shields += value;
      }
      const targetRow = sp.targets.get(who.toMe ? "self" : target)!;
      targetRow.self = who.toMe;
      bump(targetRow.parts, skill, value);
      if (!who.toMe) bump(sp.skills.get(skill)!.parts, target, value);
      if (shield) sp.shields += value;
      else sp.healing += value;
      if (!who.toMe) sp.toAllies += value;
      sp.count += 1;
      const set = this.loadout ? this.sets.get(this.loadout) : undefined;
      if (set) set.healing = (set.healing ?? 0) + value;
      this.engage(nowMs);
    }
    this.revision += 1;
  }

  view(): BattleAnalysisView {
    const s = this.session;
    const activeSec = Math.max(1, s.activeMs / 1000);
    const sources: BattleSourceRow[] = [...s.sources.values()]
      .filter((row) => row.damage > 0)
      .sort((a, b) => b.damage - a.damage)
      .map((row) => {
        const casts = row.autocasts + row.casts;
        const element = [...row.elements.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        return {
          id: row.id,
          label: row.label,
          damage: row.damage,
          share: s.damage > 0 ? row.damage / s.damage : 0,
          dps: row.damage / activeSec,
          hits: row.hits,
          critRate: row.hits ? row.crits / row.hits : 0,
          cloneShare: row.damage ? row.cloneDamage / row.damage : 0,
          autocasts: row.autocasts,
          casts: row.casts,
          ...(casts ? { autocastShare: row.autocasts / casts } : {}),
          autocastLevels: [...row.autocastLevels.entries()].sort((a, b) => b[1] - a[1]).map(([level, count]) => ({ level, count })),
          ...this.formulaFor(row),
          ...(element && element !== "Unknown" ? { element } : {}),
          ...(row.id === BASIC_ATTACK && s.multistrike.extraHits ? { multistrike: { ...s.multistrike } } : {}),
        };
      });
    const elements = [...s.elements.entries()]
      .filter(([name]) => name !== "Unknown")
      .sort((a, b) => b[1] - a[1])
      .map(([name, damage]) => ({ name, damage, share: s.damage > 0 ? damage / s.damage : 0 }));
    const sets: BattleSetRow[] = [...this.sets.values()]
      .sort((a, b) => b.lastAt - a.lastAt)
      .map((set) => ({
        key: set.key,
        current: set.key === this.loadout,
        items: set.items,
        damage: set.damage,
        activeSec: set.activeMs / 1000,
        dps: set.activeMs > 0 ? set.damage / (set.activeMs / 1000) : 0,
        dtps: set.engagedMs ? (set.taken ?? 0) / (set.engagedMs / 1000) : 0,
        hps: set.engagedMs ? (set.healing ?? 0) / (set.engagedMs / 1000) : 0,
        lastAt: set.lastAt,
        top: Object.entries(set.sources).sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([label, damage]) => ({ label, share: set.damage ? damage / set.damage : 0 })),
      }));
    return {
      revision: this.revision,
      startedAt: s.startedAt,
      damage: s.damage,
      activeSec: s.activeMs / 1000,
      dps: s.activeMs > 0 ? s.damage / activeSec : 0,
      cloneShare: s.damage ? s.cloneDamage / s.damage : 0,
      hasGear: this.lines.length > 0,
      advice: this.advice(),
      sources,
      elements,
      items: this.items(),
      sets,
      tank: this.tank(),
      support: this.support(),
    };
  }

  saveSets(): BattleSetRecord[] {
    return [...this.sets.values()].map(({ lastHitAt: _hit, lastEngagedAt: _engaged, ...rest }) => rest);
  }

  loadSets(rows: unknown): void {
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(0, MAX_SETS)) {
      if (!row || typeof row !== "object" || typeof row.key !== "string") continue;
      this.sets.set(row.key, {
        key: row.key,
        items: Array.isArray(row.items) ? row.items.map(String) : [],
        damage: num(row.damage),
        activeMs: num(row.activeMs),
        firstAt: num(row.firstAt),
        lastAt: num(row.lastAt),
        sources: row.sources && typeof row.sources === "object" ? row.sources : {},
        ...(row.taken ? { taken: num(row.taken) } : {}),
        ...(row.healing ? { healing: num(row.healing) } : {}),
        ...(row.engagedMs ? { engagedMs: num(row.engagedMs) } : {}),
      });
    }
  }

  /** The skill's percent at the level learned (or autocast at), and what it scales with. */
  /**
   * The formula for a damage source: by the game's id, else by name, else the one site id the
   * game's id starts with (the game's MeteorStorm is the site's Meteor).
   */
  private findFormula(row: SourceTally): { id: string; formula: SkillFormula } | undefined {
    const exact = this.formulas.get(row.id);
    if (exact) return { id: row.id, formula: exact };
    const label = row.label.toLowerCase();
    for (const [id, formula] of this.formulas) if (formula.name?.toLowerCase() === label) return { id, formula };
    const prefixed = [...this.formulas].filter(([id]) => id.length >= 4 && row.id.startsWith(id));
    return prefixed.length === 1 ? { id: prefixed[0]![0], formula: prefixed[0]![1] } : undefined;
  }

  private formulaFor(row: SourceTally): Pick<BattleSourceRow, "formula"> {
    const found = this.findFormula(row);
    if (!found) return {};
    const { formula } = found;
    const learned = this.snapshot?.skills?.find((skill) => skill.id === row.id || skill.id === found.id)?.level ?? 0;
    const autocast = [...row.autocastLevels.keys()].reduce((a, b) => Math.max(a, b), 0);
    const level = Math.max(learned, autocast);
    if (level <= 0) return {};
    const physical = (row.types.get(DAMAGE_TYPES.PHYSICAL) ?? 0) > (row.types.get(DAMAGE_TYPES.MAGIC) ?? 0);
    return { formula: { level, percent: formula.base + formula.perLevel * level, scales: physical ? "ATK" : "MATK" } };
  }

  /** Gear total of one bonus: a type, and for element and skill bonuses, its target. */
  private bonusTotal(type: number, target?: string): number {
    return this.lines
      .filter((line) => line.type === type && (target === undefined ? !line.target : String(line.target?.id ?? "").toLowerCase() === target.toLowerCase()))
      .reduce((sum, line) => sum + line.value, 0);
  }

  /** What one more point of each damage stat would add, best first. */
  private advice(): BattleAdviceRow[] {
    const s = this.session;
    if (s.damage <= 0 || !this.lines.length) return [];
    const rows: Omit<BattleAdviceRow, "best">[] = [];
    const flats: Omit<BattleAdviceRow, "best">[] = [];
    const pct = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}%`;
    const percentRow = (key: string, label: string, share: number, held: number) => {
      if (share < 0.05) return;
      rows.push({ key, label, gain: share / (100 + held), now: pct(held), kind: "percent" });
    };
    for (const [element, damage] of s.elements) {
      if (element === "Unknown" || element === "Neutral") continue;
      percentRow(`element:${element}`, `+1% ${element} Damage`, damage / s.damage, this.bonusTotal(STAT.ELEMENT_DAMAGE, element));
    }
    const magic = (s.types.get(DAMAGE_TYPES.MAGIC) ?? 0) / s.damage;
    const physical = (s.types.get(DAMAGE_TYPES.PHYSICAL) ?? 0) / s.damage;
    percentRow("magic-damage", "+1% Magic Damage", magic, this.bonusTotal(STAT.MAGIC_DAMAGE));
    const matkMult = this.bonusTotal(STAT.MATK_MULTIPLIER);
    percentRow("matk-mult", "+1% MATK", magic, matkMult);
    if (magic >= 0.05 && this.attack.magic && this.attack.magic > 0) {
      const gain = (magic * 10 * (1 + matkMult / 100)) / this.attack.magic;
      flats.push({ key: "matk-flat", label: "+10 MATK", gain, now: `${Math.round(this.attack.magic)} MATK`, kind: "flat", equalsPercent: gain / (magic / (100 + matkMult)) });
    }
    const atkMult = this.bonusTotal(STAT.ATK_MULTIPLIER);
    percentRow("atk-mult", "+1% ATK", physical, atkMult);
    if (physical >= 0.05 && this.attack.physical && this.attack.physical > 0) {
      const gain = (physical * 10 * (1 + atkMult / 100)) / this.attack.physical;
      flats.push({ key: "atk-flat", label: "+10 ATK", gain, now: `${Math.round(this.attack.physical)} ATK`, kind: "flat", equalsPercent: gain / (physical / (100 + atkMult)) });
    }
    for (const row of [...s.sources.values()].sort((a, b) => b.damage - a.damage).slice(0, 2)) {
      if (row.id === "Basic Attack") continue;
      percentRow(`skill:${row.id}`, `+1% ${row.label} Damage`, row.damage / s.damage, this.bonusTotal(STAT.SKILL_DAMAGE, row.id));
    }
    rows.sort((a, b) => b.gain - a.gain);
    return [...rows.map((row, index) => ({ ...row, best: index === 0 })), ...flats.map((row) => ({ ...row, best: false }))];
  }

  private nameOf(actorId: number | undefined): string | undefined {
    if (actorId === undefined) return undefined;
    try { return this.deps.nameOf?.(actorId) || undefined; } catch { return undefined; }
  }

  /** Time in combat, for the session and the worn set: anything the player dealt, took or cast. */
  private engage(nowMs: number): void {
    const s = this.session;
    const gap = (last: number | undefined) => last === undefined ? 0 : Math.min(ENGAGED_GAP_MS, Math.max(0, nowMs - last));
    s.engagedMs += gap(s.lastEngagedAt);
    s.lastEngagedAt = nowMs;
    const set = this.loadout ? this.sets.get(this.loadout) : undefined;
    if (!set) return;
    set.engagedMs = (set.engagedMs ?? 0) + gap(set.lastEngagedAt);
    set.lastEngagedAt = nowMs;
    set.lastAt = nowMs;
  }

  private tank(): BattleTankView {
    const s = this.session;
    const t = s.taken;
    const seconds = Math.max(1, s.engagedMs / 1000);
    const reflected = s.sources.get(REFLECT);
    return {
      taken: t.damage,
      activeSec: s.engagedMs / 1000,
      dtps: s.engagedMs > 0 ? t.damage / seconds : 0,
      attempts: t.attempts,
      landed: t.landed,
      crits: t.crits,
      critDamage: t.critDamage,
      missed: t.missed,
      dodged: t.dodged,
      blocked: t.blocked,
      types: byShare(t.types, t.damage),
      elements: byShare(t.elements, t.damage),
      attackers: shareRows(t.attackers, t.damage, seconds),
      absorbed: t.absorbed,
      received: t.received,
      receivedPerSec: t.received / seconds,
      healers: shareRows(t.healers, t.received, seconds),
      reflect: {
        damage: reflected?.damage ?? 0,
        perSec: (reflected?.damage ?? 0) / seconds,
        hits: reflected?.hits ?? 0,
        gear: this.lines
          .filter((line) => (line.type === STAT.REFLECT_DAMAGE || line.type === STAT.SPELL_REFLECT) && line.value)
          .map((line) => `${line.owner.name}${line.via ? ` (${line.via})` : ""}: ${line.type === STAT.REFLECT_DAMAGE ? "Reflect damage" : "Spell reflect"} +${Math.round(line.value * 10) / 10}%`),
      },
      advice: this.tankAdvice(),
    };
  }

  /**
   * What one more step of each defence would save, as a share of damage taken. Reductions of one
   * kind add up (gear "Damage from magic -10%" leaves 90%), so -1% more saves share / (100 + held);
   * a resistance saves share / (100 - held). Block turns 1% of the physical hits aimed at the player
   * into nothing: share x 1% x hits aimed / hits landed. Dodges are not ranked: players dodge with no
   * perfect dodge on their gear, so the game's "dodged" follows Flee, which is not a percent.
   */
  private tankAdvice(): BattleAdviceRow[] {
    const t = this.session.taken;
    if (t.damage <= 0) return [];
    const rows: Omit<BattleAdviceRow, "best">[] = [];
    const pct = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}%`;
    const rate = (n: number, of: number) => `${Math.round((of ? n / of : 0) * 1000) / 10}%`;
    const share = (type: string) => (t.types.get(type) ?? 0) / t.damage;
    const add = (key: string, label: string, part: number, left: number, now: string) => {
      if (part < 0.05 || left <= 1) return;
      rows.push({ key, label, gain: part / left, now, kind: "percent" });
    };
    const melee = this.bonusTotal(STAT.DAMAGE_FROM_MELEE);
    add("taken:physical", "-1% Melee damage taken", share("Physical"), 100 + melee, pct(melee));
    const magic = this.bonusTotal(STAT.DAMAGE_FROM_MAGIC);
    add("taken:magic", "-1% Magic damage taken", share("Magic"), 100 + magic, pct(magic));
    for (const [element, damage] of t.elements) {
      if (element === "Unknown") continue;
      const held = this.bonusTotal(STAT.ELEMENT_RESISTANCE, element);
      add(`resist:${element}`, `+1% ${element} resistance`, damage / t.damage, 100 - held, pct(held));
    }
    if (t.physicalAttempts >= 10 && t.physicalLanded > 0) {
      rows.push({ key: "block", label: "+1% Block", gain: (share("Physical") * 0.01 * t.physicalAttempts) / t.physicalLanded, now: `${rate(t.blocked, t.physicalAttempts)} blocked${this.bonusTotal(STAT.BLOCK) ? ` (${pct(this.bonusTotal(STAT.BLOCK))} gear)` : ""}`, kind: "percent" });
    }
    rows.sort((a, b) => b.gain - a.gain);
    return rows.map((row, index) => ({ ...row, best: index === 0 }));
  }

  private support(): BattleSupportView {
    const s = this.session;
    const sp = s.support;
    const seconds = Math.max(1, s.engagedMs / 1000);
    const total = sp.healing + sp.shields;
    const healingBonus = this.bonusTotal(STAT.HEALING);
    return {
      healing: sp.healing,
      shields: sp.shields,
      toAllies: sp.toAllies,
      activeSec: s.engagedMs / 1000,
      hps: s.engagedMs > 0 ? total / seconds : 0,
      allyHps: s.engagedMs > 0 ? sp.toAllies / seconds : 0,
      count: sp.count,
      targets: shareRows(sp.targets, total, seconds),
      skills: shareRows(sp.skills, total, seconds),
      healingBonus,
      ...(sp.healing > 0 && total > 0 && 100 + healingBonus > 1 ? { healingGain: sp.healing / total / (100 + healingBonus) } : {}),
    };
  }

  private sourceRow(id: string, label?: string): SourceTally {
    let row = this.session.sources.get(id);
    if (!row) {
      row = { id, label: label || id, damage: 0, hits: 0, crits: 0, cloneDamage: 0, autocasts: 0, casts: 0, autocastLevels: new Map(), elements: new Map(), types: new Map() };
      this.session.sources.set(id, row);
    }
    if (label && row.label === row.id) row.label = label;
    return row;
  }

  private loadoutItems(snapshot: CharacterSnapshot): string[] {
    return snapshot.equipment.filter((item) => item?.itemId).map((item) => {
      let name = item.itemId;
      try { name = this.deps.resolveItem(ITEM_TYPE.EQUIPMENT, item.itemId)?.displayName || name; } catch { /* keep the id */ }
      return `${num(item.refine) ? `+${num(item.refine)} ` : ""}${name}`;
    });
  }

  private pruneSets(): void {
    if (this.sets.size <= MAX_SETS) return;
    const oldest = [...this.sets.values()].filter((set) => set.key !== this.loadout).sort((a, b) => a.lastAt - b.lastAt)[0];
    if (oldest) this.sets.delete(oldest.key);
  }

  private skillName(id: string | undefined): string {
    if (!id) return "Skill";
    const seen = this.session.sources.get(id);
    if (seen?.label && seen.label !== id) return seen.label;
    try { return this.deps.resolveSkill?.(id)?.displayName || id; } catch { return id; }
  }

  /** Learned skills that autocast a skill themselves, by skill id. */
  private classAutocasters(): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const skill of this.snapshot?.skills ?? []) {
      let effects: readonly { label?: string }[] = skill.effects ?? [];
      if (!effects.length) {
        try { effects = this.deps.resolveSkill?.(skill.id)?.effects ?? []; } catch { effects = []; }
      }
      for (const effect of effects) {
        const match = String(effect?.label ?? "").match(/^SkillAutocast\s+(\S+)/);
        if (!match) continue;
        out.set(match[1]!, [...(out.get(match[1]!) ?? []), skill.displayName || skill.id]);
      }
    }
    return out;
  }

  /** What each worn item is worth in this session, measured where possible. */
  private items(): BattleItemRow[] {
    const s = this.session;
    const byOwner = new Map<string, Omit<BattleItemRow, "share" | "unmeasured"> & { unmeasured: Set<string> }>();
    const entry = (owner: Owner) => {
      let item = byOwner.get(owner.key);
      if (!item) {
        item = { key: owner.key, slot: owner.slot, name: owner.name, refine: owner.refine, damage: 0, parts: [], unmeasured: new Set() };
        byOwner.set(owner.key, item);
      }
      return item;
    };
    for (const line of this.lines) entry(line.owner);

    // Autocasts: a skill's damage times the share of its casts that were autocasts, shared by the
    // items that can autocast it, by chance.
    const classAutocasters = this.classAutocasters();
    const bySkill = new Map<string, GearLine[]>();
    for (const line of this.lines) {
      if ((line.type !== STAT.AUTOCAST_ON_ATTACK && line.type !== STAT.AUTOCAST_ON_HIT) || line.target?.kind !== "skill" || line.value <= 0) continue;
      bySkill.set(line.target.id, [...(bySkill.get(line.target.id) ?? []), line]);
    }
    for (const [skillId, list] of bySkill) {
      const row = s.sources.get(skillId);
      if (!row || row.damage <= 0) continue;
      const casts = row.autocasts + row.casts;
      const autoShare = casts > 0 ? row.autocasts / casts : 0;
      const autoDamage = row.damage * autoShare;
      if (autoDamage <= 0) continue;
      const chanceByOwner = new Map<string, { owner: Owner; chance: number }>();
      for (const line of list) {
        const current = chanceByOwner.get(line.owner.key);
        chanceByOwner.set(line.owner.key, { owner: line.owner, chance: (current?.chance ?? 0) + line.value });
      }
      const totalChance = [...chanceByOwner.values()].reduce((sum, { chance }) => sum + chance, 0);
      const others = classAutocasters.get(skillId) ?? [];
      for (const { owner, chance } of chanceByOwner.values()) {
        const shared = chanceByOwner.size > 1;
        const damage = autoDamage * (shared ? chance / totalChance : 1);
        const item = entry(owner);
        item.damage += damage;
        item.parts.push({
          label: `Autocasts ${this.skillName(skillId)}`,
          detail: `${Math.round(chance * 10) / 10}% chance`,
          damage,
          kind: shared ? "split" : "measured",
          note: [
            shared ? `shared with ${chanceByOwner.size - 1} other item${chanceByOwner.size > 2 ? "s" : ""} by chance` : "",
            others.length ? `at most: ${others.join(", ")} also autocasts it` : "",
            casts > 0 && autoShare < 1 ? `${Math.round(autoShare * 100)}% of its casts were autocasts` : "",
          ].filter(Boolean).join("; "),
          ...(others.length ? { upTo: true } : {}),
        });
      }
    }

    // Multistrike: the extra strikes' damage, shared by each item's Multistrike value.
    const strike = new Map<string, { owner: Owner; value: number }>();
    for (const line of this.lines) {
      if (line.type !== STAT.MULTISTRIKE || line.value <= 0) continue;
      strike.set(line.owner.key, { owner: line.owner, value: (strike.get(line.owner.key)?.value ?? 0) + line.value });
    }
    const strikeTotal = [...strike.values()].reduce((sum, { value }) => sum + value, 0);
    if (strikeTotal > 0 && s.multistrike.damage > 0) {
      for (const { owner, value } of strike.values()) {
        const damage = s.multistrike.damage * (value / strikeTotal);
        const item = entry(owner);
        item.damage += damage;
        item.parts.push({
          label: `Multistrike +${Math.round(value)}%`,
          detail: `${s.multistrike.extraHits} extra strikes in all`,
          damage,
          kind: strike.size > 1 ? "split" : "measured",
          note: strike.size > 1 ? "extra strikes shared by Multistrike value" : "",
        });
      }
    }

    // Percent bonuses: value / (100 + every line of the same bonus) of the damage it applies to.
    const bonusKey = (line: GearLine) => `${line.type}|${line.target?.kind ?? ""}|${String(line.target?.id ?? "").toLowerCase()}`;
    const bonusLines = this.lines.filter((line) => (line.type === STAT.ELEMENT_DAMAGE || line.type === STAT.SKILL_DAMAGE || line.type === STAT.MAGIC_DAMAGE) && line.value);
    const totals = new Map<string, number>();
    for (const line of bonusLines) bump(totals, bonusKey(line), line.value);
    for (const line of bonusLines) {
      const base = this.damageFor(line);
      if (base <= 0) continue;
      const total = totals.get(bonusKey(line)) ?? line.value;
      const damage = (base * line.value) / (100 + total);
      const item = entry(line.owner);
      item.damage += damage;
      item.parts.push({
        label: this.bonusLabel(line) + (line.via ? ` (${line.via})` : ""),
        detail: `of ${Math.round((base / Math.max(1, s.damage)) * 100)}% of your damage`,
        damage,
        kind: "estimated",
        note: `${Math.round(total)}% of this bonus in all`,
      });
    }

    for (const line of this.lines) {
      const name = UNMEASURED[line.type];
      if (name && line.value) entry(line.owner).unmeasured.add(name);
    }

    return [...byOwner.values()]
      .map((item) => ({ ...item, share: s.damage > 0 ? item.damage / s.damage : 0, parts: item.parts.sort((a, b) => b.damage - a.damage), unmeasured: [...item.unmeasured] }))
      .sort((a, b) => b.damage - a.damage || a.slot.localeCompare(b.slot));
  }

  private damageFor(line: GearLine): number {
    const s = this.session;
    switch (line.type) {
      case STAT.ELEMENT_DAMAGE: { const element = elementOf(line.target?.id); return element ? s.elements.get(element) ?? 0 : 0; }
      case STAT.SKILL_DAMAGE: return line.target?.kind === "skill" ? s.sources.get(line.target.id)?.damage ?? 0 : 0;
      case STAT.MAGIC_DAMAGE: return line.target ? 0 : s.types.get(DAMAGE_TYPES.MAGIC) ?? 0;
      default: return 0;
    }
  }

  private bonusLabel(line: GearLine): string {
    const pct = `${line.value > 0 ? "+" : ""}${Math.round(line.value * 10) / 10}%`;
    if (line.type === STAT.ELEMENT_DAMAGE) return `${elementOf(line.target?.id) ?? line.target?.id ?? "Element"} Damage ${pct}`;
    if (line.type === STAT.SKILL_DAMAGE) return `${this.skillName(line.target?.id)} Damage ${pct}`;
    if (line.type === STAT.MAGIC_DAMAGE) return `Magic Damage ${pct}`;
    return pct;
  }
}
