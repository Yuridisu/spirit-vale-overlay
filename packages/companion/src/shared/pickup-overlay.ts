import type { LootLine } from "./contracts.ts";

export interface PickupNotification {
  sequence: number;
  name: string;
  icon: string | null;
  quantity: number;
  color: string;
  tag: string | null;
  refine: number;
  lines: LootLine[];
}
