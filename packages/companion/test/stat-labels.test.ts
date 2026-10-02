import { expect, test } from "bun:test";
import { STAT_LABEL, statLabel } from "../src/shared/stat-labels.ts";
import { STAT_ALIASES } from "../src/core/filter/loot-filter.ts";

// Every substat the capture layer can decode on equipment or artifacts.
const SUBSTATS = [
  "Agi", "Atk", "AtkMult", "AtkSpd", "AtkSpdLimit", "CastRange", "CastSpd", "Chain", "CooldownRecovery", "Crit", "CritDamage",
  "DamageFromMagic", "DamageFromMelee", "DamageMagic", "DamageMelee", "DamageRanged", "Def", "DefMult", "Dex", "DoubleAttack",
  "Flee", "Healing", "HealingReceived", "Hit", "HpMult", "HpRegenMult", "Int", "Leech", "Luk", "Matk", "MatkMult", "Mdef",
  "MdefMult", "MoveSpd", "MpCost", "MpMult", "MpRegenMult", "PerfectDodge", "Range", "Str", "Vit",
];

test("every decodable substat has a hand-written label", () => {
  const missing = SUBSTATS.filter((stat) => !(stat in STAT_LABEL));
  expect(missing).toEqual([]);
});

test("labels are unique, so two stats never read the same", () => {
  const labels = Object.values(STAT_LABEL);
  expect(new Set(labels).size).toBe(labels.length);
});

test("Hit and Crit stay distinct", () => {
  expect(statLabel("Hit")).toBe("Hit");
  expect(statLabel("Crit")).toBe("Crit");
});

test("unknown identifiers fall back to a CamelCase split", () => {
  expect(statLabel("SummonAtkSpd")).toBe("Summon Atk Spd");
  expect(statLabel("Str")).toBe("Str");
});

test("rule-language aliases agree with the display labels", () => {
  // The parser accepts these friendly spellings; the label should be the same idea, so a player
  // who reads "Attack Speed" in the inspector can type AttackSpeed into a rule.
  for (const { friendly, internal } of STAT_ALIASES) {
    expect(statLabel(internal).replace(/[^a-z]/gi, "").toLowerCase()).toBe(friendly.toLowerCase());
  }
});
