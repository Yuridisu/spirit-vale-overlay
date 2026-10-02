export type ModuleId = "loot" | "market" | "gold";

export interface CompanionModule {
  id: ModuleId;
  name: string;
  description: string;
  shortcut: "1" | "2" | "3";
}

export const companionModules = [
  {
    id: "loot",
    name: "Loot",
    description: "Inventory filter and local alerts",
    shortcut: "1",
  },
  {
    id: "market",
    name: "Market",
    description: "Global listings and price history",
    shortcut: "2",
  },
  {
    id: "gold",
    name: "Gold",
    description: "Session income, spend, and efficiency analytics",
    shortcut: "3",
  },
] as const satisfies readonly CompanionModule[];

export function isModuleId(value: string): value is ModuleId {
  return companionModules.some((module) => module.id === value);
}
