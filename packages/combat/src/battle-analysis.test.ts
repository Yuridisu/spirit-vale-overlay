import { describe, expect, test } from "bun:test";
import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";

import { BattleAnalysis, gearLines, loadoutKey, type BattleEvent, type ItemResolver } from "./battle-analysis.ts";

const CATALOG: Record<string, unknown> = {
  "2:Stormcall Kunai": {
    displayName: "Stormcall Kunai",
    effects: [{ type: 9, value: 15 }, { type: 80, value: 50 }],
    refineEffects: [{ type: 40, value: 1, target: { kind: "skill", id: "ChainLightning" } }],
  },
  "2:Drooping Cat": {
    displayName: "Drooping Cat",
    effects: [{ type: 42, value: 3, target: { kind: "skill", id: "Thunderbolt" } }],
    refineEffects: [{ type: 40, value: 3, target: { kind: "skill", id: "Thunderbolt" } }],
  },
  "4:Wisp Purple": { displayName: "Lightning Wisp Card", effects: [{ type: 46, value: 6, target: { kind: "element", id: "Wind" } }] },
};
const resolveItem: ItemResolver = (type, id) => CATALOG[`${type}:${id}`] as ReturnType<ItemResolver>;

const snapshot = {
  name: "Fictional Hero",
  equipment: [
    { slot: "Weapon", itemId: "Stormcall Kunai", refine: 9, cards: ["Wisp Purple", "Wisp Purple"], substats: [] },
    { slot: "Offhand", itemId: "Stormcall Kunai", refine: 9, cards: [], substats: [] },
    { slot: "Head", itemId: "Drooping Cat", refine: 9, cards: [], substats: [{ type: 48, name: "Magic damage", roll: 50, value: 4, percent: true }] },
  ],
  artifacts: [],
  skills: [{ id: "ChainLightning", displayName: "Chain Lightning", level: 5, effects: [] }],
} as unknown as CharacterSnapshot;

const hit = (sourceId: string, value: number, extra: Partial<BattleEvent> = {}): BattleEvent =>
  ({ kind: "damage", sourceId, sourceLabel: sourceId, value, element: 6, damageType: 1, hitResult: "normal", tick: 1, targetId: 9, ...extra });
const cast = (rpc: string, sourceId: string, level?: number): BattleEvent => ({ kind: "activation", rpc, sourceId, ...(level === undefined ? {} : { level }) });
const REFLECT_ID = "reflect";

describe("gearLines", () => {
  test("keeps targets, multiplies refine effects and reads cards", () => {
    const lines = gearLines(snapshot, resolveItem);
    expect(lines.filter((l) => l.type === 40).map((l) => [l.owner.name, l.value, l.target?.id])).toEqual([
      ["Stormcall Kunai", 9, "ChainLightning"],
      ["Stormcall Kunai", 9, "ChainLightning"],
      ["Drooping Cat", 27, "Thunderbolt"],
    ]);
    const wisps = lines.filter((l) => l.type === 46);
    expect(wisps).toHaveLength(2);
    expect(wisps[0]!.via).toBe("Lightning Wisp Card");
  });

  test("a set key ignores slot order", () => {
    expect(loadoutKey({ ...snapshot, equipment: [...snapshot.equipment].reverse() })).toBe(loadoutKey(snapshot));
  });
});

describe("BattleAnalysis", () => {
  test("splits a shared autocast by chance and only its autocast share", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.setCharacter(snapshot, 0);
    for (let i = 0; i < 3; i += 1) a.noteActivation(cast("AutoCast_C", "ChainLightning", 5));
    a.noteActivation(cast("CastBegin_C", "ChainLightning"));
    a.noteDamage(hit("ChainLightning", 1000), 0);
    const view = a.view();
    const parts = view.items.filter((i) => i.name === "Stormcall Kunai").map((k) => k.parts.find((p) => p.label.startsWith("Autocasts"))!);
    expect(parts.map((p) => Math.round(p.damage))).toEqual([375, 375]);
    expect(parts[0]!.kind).toBe("split");
    expect(view.sources[0]!.autocastShare).toBe(0.75);
    expect(view.sources[0]!.autocastLevels).toEqual([{ level: 5, count: 3 }]);
  });

  test("a cancelled cast does not count; zone markers are not skills", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.noteActivation(cast("CastBegin_C", "IceRelease"));
    a.noteActivation(cast("CastBegin_C", "IceRelease"));
    a.noteActivation(cast("CastCancel_C", "IceRelease"));
    a.noteActivation({ kind: "activation", sourceId: "__spiritvaleZone:57" });
    a.noteDamage(hit("IceRelease", 10, { element: 5 }), 0);
    expect(a.view().sources.map((s) => [s.id, s.casts])).toEqual([["IceRelease", 1]]);
  });

  test("percent bonuses are estimated against the damage they apply to", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.setCharacter(snapshot, 0);
    a.noteDamage(hit("ChainLightning", 1120), 0);
    a.noteDamage(hit("Basic Attack", 100, { element: 0, damageType: 2 }), 0);
    const view = a.view();
    const wind = view.items.find((i) => i.slot === "Weapon")!.parts.filter((p) => p.label.startsWith("Wind Damage"));
    expect(wind.map((p) => Math.round(p.damage))).toEqual([60, 60]);
    expect(wind[0]!.kind).toBe("estimated");
    const cat = view.items.find((i) => i.name === "Drooping Cat")!;
    expect(Math.round(cat.parts.find((p) => p.label.startsWith("Magic Damage"))!.damage)).toBe(Math.round((1120 * 4) / 104));
  });

  test("extra basic-attack packets on one target in one tick are Multistrike", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.setCharacter(snapshot, 0);
    const basic = { element: 0, damageType: 2, tick: 7, targetId: 3 };
    a.noteDamage(hit("Basic Attack", 100, basic), 0);
    a.noteDamage(hit("Basic Attack", 100, basic), 0);
    a.noteDamage(hit("Basic Attack", 100, { ...basic, tick: 8 }), 0);
    const view = a.view();
    expect(view.sources[0]!.multistrike).toEqual({ extraHits: 1, damage: 100 });
    expect(view.items.filter((i) => i.name === "Stormcall Kunai").map((i) => i.parts.find((p) => p.label.startsWith("Multistrike"))!.damage)).toEqual([50, 50]);
  });

  test("shows each skill's formula at its level, and ranks the next stat by what it adds", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.setCharacter(snapshot, 0);
    a.setSkillFormulas({ ChainLightning: { base: 0, perLevel: 300 } });
    a.setAttack({ magic: 1000 });
    a.noteActivation(cast("AutoCast_C", "ChainLightning", 5));
    a.noteDamage(hit("ChainLightning", 900), 0);
    a.noteDamage(hit("Basic Attack", 100, { element: 0, damageType: 2 }), 0);
    const view = a.view();
    expect(view.sources[0]!.formula).toEqual({ level: 5, percent: 1500, scales: "MATK" });
    const byKey = Object.fromEntries(view.advice.map((row) => [row.key, row]));
    // Wind is 90% of the damage and the cards hold 12% of it: 0.9 / 112.
    expect(byKey["element:Wind"]!.gain).toBeCloseTo(0.9 / 112, 6);
    // Magic Damage has 4% held already (0.9 / 104); MATK % has none (0.9 / 100), so it leads:
    // the bonus held least is the one worth most.
    expect(byKey["magic-damage"]!.gain).toBeCloseTo(0.9 / 104, 6);
    expect(view.advice[0]!.key).toBe("matk-mult");
    expect(view.advice[0]!.best).toBe(true);
    // Flat MATK is not ranked against percents; it is given as the MATK % it equals.
    expect(byKey["matk-flat"]).toMatchObject({ kind: "flat", best: false });
    expect(byKey["matk-flat"]!.gain).toBeCloseTo((0.9 * 10) / 1000, 6);
    expect(byKey["matk-flat"]!.equalsPercent).toBeCloseTo(1, 6);
    expect(view.advice.filter((row) => row.best)).toHaveLength(1);
    // A game id the site spells shorter is found by its prefix.
    const b = new BattleAnalysis({ resolveItem });
    b.setCharacter({ ...snapshot, skills: [{ id: "Meteor", displayName: "Meteor", level: 10, effects: [] }] } as unknown as CharacterSnapshot, 0);
    b.setSkillFormulas({ Meteor: { base: 0, perLevel: 400, name: "Meteor" } });
    b.noteDamage(hit("MeteorStorm", 100, { sourceLabel: "Meteor Storm" }), 0);
    expect(b.view().sources[0]!.formula).toEqual({ level: 10, percent: 4000, scales: "MATK" });
  });

  test("tank: hits taken by type, element and attacker, what was avoided, reflected and absorbed, and the defence to raise", () => {
    const names: Record<number, string> = { 50: "Fire Drake", 51: "Ally Cleric" };
    const a = new BattleAnalysis({ resolveItem, nameOf: (id) => names[id] });
    a.setCharacter(snapshot, 0);
    const taken = (value: number, extra: Partial<BattleEvent>): BattleEvent => ({ kind: "damage", actorId: 50, targetId: 1, value, hitResult: "normal", ...extra });
    for (let i = 0; i < 8; i += 1) a.noteTaken(taken(100, { sourceId: "Basic Attack", sourceLabel: "Basic Attack", damageType: 0, element: 0 }), i * 1000);
    a.noteTaken(taken(0, { hitResult: "blocked", damageType: 0, element: 0 }), 8000);
    a.noteTaken(taken(0, { hitResult: "dodged", damageType: 0, element: 0 }), 9000);
    a.noteTaken(taken(600, { sourceId: "FireBreath", sourceLabel: "Fire Breath", damageType: 1, element: 4, hitResult: "critical" }), 10000);
    a.noteDamage(hit(REFLECT_ID, 70, { damageType: 4, element: 0, sourceLabel: "Reflect Damage" }), 10000);
    a.noteRecovery({ kind: "shield", action: "absorbed", targetId: 1, value: 50 }, 10000, { byMe: false, toMe: true });
    a.noteRecovery({ kind: "heal", actorId: 51, targetId: 1, value: 300, sourceLabel: "Heal", recoveryStyle: "standard" }, 10000, { byMe: false, toMe: true });
    const tank = a.view().tank;
    expect(tank).toMatchObject({ taken: 1400, attempts: 11, landed: 9, blocked: 1, dodged: 1, crits: 1, absorbed: 50, received: 300 });
    expect(tank.activeSec).toBe(10);
    expect(tank.types.map((row) => [row.name, row.damage])).toEqual([["Physical", 800], ["Magic", 600]]);
    expect(tank.attackers[0]).toMatchObject({ label: "Fire Drake", amount: 1400, count: 9, parts: ["Basic Attack 57%", "Fire Breath 43%"] });
    expect(tank.healers[0]).toMatchObject({ label: "Ally Cleric", amount: 300 });
    expect(tank.reflect).toMatchObject({ damage: 70, hits: 1 });
    // Magic is 43% of the damage with nothing held: 0.43 / 100; Fire resistance the same; melee 57%.
    const byKey = Object.fromEntries(tank.advice.map((row) => [row.key, row]));
    expect(byKey["taken:magic"]!.gain).toBeCloseTo(600 / 1400 / 100, 6);
    expect(byKey["taken:physical"]!.gain).toBeCloseTo(800 / 1400 / 100, 6);
    // Block: 10 physical hits aimed, 8 landed: each 1% saves 800/1400 x 1% x 10 / 8.
    expect(byKey["block"]!.gain).toBeCloseTo((800 / 1400) * 0.01 * 10 / 8, 6);
    expect(byKey["perfect-dodge"]).toBeUndefined();
    expect(tank.advice.filter((row) => row.best)).toHaveLength(1);
  });

  test("support: heals and shields cast, per ally and per skill, without the player's own regeneration", () => {
    const names: Record<number, string> = { 51: "Ally Knight" };
    const a = new BattleAnalysis({ resolveItem, nameOf: (id) => names[id] });
    a.noteRecovery({ kind: "heal", actorId: 1, targetId: 51, value: 1000, sourceLabel: "Heal", recoveryStyle: "standard" }, 0, { byMe: true, toMe: false });
    a.noteRecovery({ kind: "heal", actorId: 1, targetId: 51, value: 1000, sourceLabel: "Heal", recoveryStyle: "standard" }, 2000, { byMe: true, toMe: false });
    a.noteRecovery({ kind: "shield", action: "gained", actorId: 1, targetId: 51, value: 500, sourceLabel: "Sacred Aegis" }, 4000, { byMe: true, toMe: false });
    a.noteRecovery({ kind: "heal", actorId: 1, targetId: 1, value: 400, sourceLabel: "Heal", recoveryStyle: "standard" }, 4000, { byMe: true, toMe: true });
    a.noteRecovery({ kind: "heal", actorId: 1, targetId: 1, value: 9999, sourceLabel: "Passive regeneration", recoveryStyle: "passive-regeneration" }, 4000, { byMe: true, toMe: true });
    const support = a.view().support;
    expect(support).toMatchObject({ healing: 2400, shields: 500, toAllies: 2500, count: 4, activeSec: 4 });
    expect(support.allyHps).toBeCloseTo(2500 / 4, 6);
    expect(support.targets.map((row) => [row.label, row.amount, row.self ?? false])).toEqual([["Ally Knight", 2500, false], ["You", 400, true]]);
    expect(support.targets[0]!.shields).toBe(500);
    expect(support.skills.map((row) => [row.label, row.amount])).toEqual([["Heal", 2400], ["Sacred Aegis", 500]]);
    // Regeneration is the player's own sustain: received for Tank, never counted as support.
    expect(a.view().tank.received).toBe(10399);
  });

  test("damage per second counts fighting time only, follows the worn set, and sets survive a reset and a reload", () => {
    const a = new BattleAnalysis({ resolveItem });
    a.setCharacter(snapshot, 0);
    a.noteDamage(hit("ChainLightning", 100), 0);
    a.noteDamage(hit("ChainLightning", 100), 1000);
    a.noteDamage(hit("ChainLightning", 100), 60_000); // after a break: adds 3 s at most
    expect(a.view().activeSec).toBe(4);
    expect(Math.round(a.view().sets[0]!.dps)).toBe(75);
    a.setCharacter({ ...snapshot, equipment: snapshot.equipment.slice(0, 2) }, 70_000);
    a.noteDamage(hit("ChainLightning", 50), 70_000);
    expect(a.view().sets).toHaveLength(2);
    a.reset();
    expect(a.view().damage).toBe(0);
    expect(a.view().sets).toHaveLength(2);
    const b = new BattleAnalysis({ resolveItem });
    b.loadSets(JSON.parse(JSON.stringify(a.saveSets())));
    expect(b.view().sets.map((s) => s.damage).sort((x, y) => x - y)).toEqual([50, 300]);
  });
});
