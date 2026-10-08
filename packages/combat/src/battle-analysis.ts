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
 * Pure: the caller feeds it the player's own events and character snapshot; resolvers are injected.
 * Ported from the analysis written for Spiritvale Companion 2.0.
 */
import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";

/** The game's element numbers. 0, 1, 3, 4, 5, 6 and 8 are confirmed by skills and statuses. */
export const ELEMENT_NAMES: Record<number, string> = {
  0: "Neutral", 1: "Poison", 2: "Earth", 3: "Shadow", 4: "Fire", 5: "Water", 6: "Wind", 7: "Holy", 8: "Undead", 9: "Ghost",
};

/** ApplyDamage_C damage types seen in captures. */
export const DAMAGE_TYPES = { MAGIC: 1, PHYSICAL: 2, STATUS: 3 } as const;

const STAT = {
  AUTOCAST_ON_HIT: 39,
  AUTOCAST_ON_ATTACK: 40,
  ELEMENT_DAMAGE: 46,
  MAGIC_DAMAGE: 48,
  SKILL_DAMAGE: 49,
  MULTISTRIKE: 80,
  ATK_MULTIPLIER: 69,
  MATK_MULTIPLIER: 70,
} as const;

/** Hits closer together than this count as one stretch of fighting for damage per second. */
const ACTIVE_GAP_MS = 3_000;
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
}

interface ItemEffect { type: number; value: number; target?: { kind: string; id: string } }
interface ItemDefinition { displayName?: string; effects?: readonly ItemEffect[]; refineEffects?: readonly ItemEffect[] }
interface SkillDefinition { displayName?: string; effects?: readonly { label?: string }[] }
export type ItemResolver = (itemType: number, itemId: string) => ItemDefinition | undefined | null;
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

interface Session {
  startedAt: number;
  damage: number;
  activeMs: number;
  lastHitAt?: number;
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
  return { startedAt: nowMs, damage: 0, activeMs: 0, sources: new Map(), elements: new Map(), types: new Map(), cloneDamage: 0, multistrike: { extraHits: 0, damage: 0 } };
}

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
  private readonly sets = new Map<string, BattleSetRecord & { lastHitAt?: number }>();
  private formulas = new Map<string, SkillFormula>();
  private attack: { magic?: number; physical?: number } = {};
  revision = 0;

  constructor(private readonly deps: { resolveItem: ItemResolver; resolveSkill?: SkillResolver; rescale?: SubstatRescaler }) {}

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
    };
  }

  saveSets(): BattleSetRecord[] {
    return [...this.sets.values()].map(({ lastHitAt: _unused, ...rest }) => rest);
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
