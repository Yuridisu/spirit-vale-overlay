/**
 * Display names for the game's stat identifiers.
 *
 * Packets, the catalog, the market API and the rule language all use the client's enum names
 * (`AtkSpd`, `MatkMult`, `Hit`). Those stay canonical everywhere data flows. This map is for the
 * one place a human reads them: the renderer. Keep the canonical name reachable (tooltip, search)
 * so a player can still type it into a rule.
 *
 * Only stats that appear as equipment or artifact substats are listed. Anything else falls back to
 * splitting the CamelCase identifier, which is readable enough for a stat nobody has met yet.
 */
export const STAT_LABEL: Readonly<Record<string, string>> = {
  Agi: "Agi",
  Atk: "Atk",
  AtkMult: "Atk %",
  AtkSpd: "Attack Speed",
  AtkSpdLimit: "Attack Speed Limit",
  CastRange: "Cast Range",
  CastSpd: "Cast Speed",
  Chain: "Auto-Attack Chain",
  CooldownRecovery: "Cooldown Recovery",
  Crit: "Crit",
  CritDamage: "Crit Damage",
  DamageFromMagic: "Damage from Magic",
  DamageFromMelee: "Damage from Melee",
  DamageFromRanged: "Damage from Ranged",
  DamageMagic: "Magic Damage",
  DamageMelee: "Melee Damage",
  DamageRanged: "Ranged Damage",
  Def: "Def",
  DefMult: "Def %",
  Dex: "Dex",
  DoubleAttack: "Multistrike",
  Flee: "Flee",
  Healing: "Healing",
  HealingReceived: "Healing Received",
  Hit: "Hit",
  HpMult: "Hp %",
  HpRegenMult: "Hp Regen %",
  Int: "Int",
  Leech: "Health Leech",
  Luk: "Luk",
  Matk: "Matk",
  MatkMult: "Matk %",
  Mdef: "Mdef",
  MdefMult: "Mdef %",
  MoveSpd: "Movement Speed",
  MpCost: "Mp Cost",
  MpMult: "Mp %",
  MpRegenMult: "Mp Regen %",
  PerfectDodge: "Perfect Dodge",
  Range: "Range",
  Str: "Str",
  Vit: "Vit",
};

/** Human label for a stat identifier. Unknown identifiers get their CamelCase split into words. */
export function statLabel(name: string): string {
  return STAT_LABEL[name] ?? name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}
