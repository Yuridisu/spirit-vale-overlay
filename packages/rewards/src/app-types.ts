import type { RPCSchema } from "@svoverlay/contracts/rpc";
import type { LocalizedText } from "@svoverlay/i18n/messages";
import type { RewardLogStatus } from "@kar-mi/spirit-vale-tools-rewards";
import type { RateSnapshot } from "@kar-mi/spirit-vale-tools-metrics";
import type { MaximizableWindowChromeRequests } from "@svoverlay/contracts/window-rpc";

export type RateTotals = Omit<RateSnapshot, "timeline">;

export type RewardsAppMode = "live" | "replay";
export type RewardsAppView = "summary" | "recent" | "trends" | "xpTracker" | "itemCounter" | "targetDrops";
export type RewardsAppStatus = RewardLogStatus;

export interface RewardsUiDrop { category: string; itemId: string; itemName: string; count: number; chance?: number }
export interface RewardsUiMob {
  id: string;
  displayName: string;
  level: number;
  boss: boolean;
  baseExperience: number;
  baseCoins: number;
  drops: RewardsUiDrop[];
}
export interface RewardsUiKill {
  id: string;
  timestamp?: string;
  mobId: string;
  displayName: string;
  level: number;
  experience: number;
  jobExperience: number;
  coins: string;
  drops: RewardsUiDrop[];
}
export interface RewardsUiSummary {
  mobId: string;
  displayName: string;
  level: number;
  kills: number;
  attributedKills: number;
  experience: number;
  jobExperience: number;
  coins: string;
  drops: RewardsUiDrop[];
}

/** The overlay's item counter: what it follows, and everything in the bag it could follow. */
export interface RewardsItemCounterState {
  /** The item followed in each slot; an empty string is a free slot. */
  slots: string[];
  /** False until the game has reported the bag. */
  known: boolean;
  items: Array<{ name: string; count: number; gained: number }>;
}

/** One drop the player is hunting: its type, words of its name, the stats it must have, and its sound. */
export interface RewardsTargetDrop {
  name: string;
  /** `any`, `equipment`, `weapon`, `artifact`, or one slot or artifact piece. */
  type: string;
  sound: string;
  stats: Array<{ stat: string; min: number }>;
}

export interface RewardsTargetDropState {
  /** One per slot; a slot with no name and no type is unused. */
  targets: RewardsTargetDrop[];
  sound: boolean;
  /** 0-100. */
  volume: number;
  /** Every stat a drop can carry, as the overlay labels it. */
  statChoices: string[];
  /** The types a target can be narrowed to, grouped for the picker. */
  typeChoices: Array<{ id: string; group: "generic" | "armor" | "weapon" | "artifact" }>;
  /** The built-in tones, then the player's own sounds. */
  soundChoices: string[];
}

export interface RewardsUiGraphSample {
  recordedAt: string;
  experience: number;
  jobExperience: number;
  coins: string;
}

export interface RewardsAppState {
  mode: RewardsAppMode;
  view: RewardsAppView;
  status: RewardsAppStatus;
  statusDetail: LocalizedText;
  /** Joined onto `statusDetail` with a separator; each part pluralizes on its own count. */
  statusDetailExtras?: LocalizedText[];
  storageWarning?: LocalizedText;
  pinned: boolean;
  resetting: boolean;
  replayFileName?: string;
  replayWarnings: number;
  kills: RewardsUiKill[];
  graphSamples: RewardsUiGraphSample[];
  summaries: RewardsUiSummary[];
  totalExperience: number;
  xpToLevelUp?: number;
  totalJobExperience: number;
  totalCoins: string;
  unmatched: number;
  unmatchedDrops: RewardsUiDrop[];
  unidentified: number;
  xp: RateSnapshot;
  gold: RateTotals;
  itemCounter: RewardsItemCounterState;
  targetDrops: RewardsTargetDropState;
}

export type RewardsAppRpc = {
  bun: RPCSchema<{
    requests: MaximizableWindowChromeRequests & {
      getState: { params: Record<string, never>; response: RewardsAppState };
      setMode: { params: { mode: RewardsAppMode }; response: RewardsAppState };
      setView: { params: { view: RewardsAppView }; response: RewardsAppState };
      openCatalog: { params: Record<string, never>; response: void };
      openReplayPicker: { params: Record<string, never>; response: void };
      setPinned: { params: { pinned: boolean }; response: RewardsAppState };
      resetSession: { params: Record<string, never>; response: RewardsAppState };
      resetXpTracker: { params: Record<string, never>; response: RewardsAppState };
      resetGoldTracker: { params: Record<string, never>; response: RewardsAppState };
      setItemCounterItems: { params: { items: string[] }; response: RewardsAppState };
      setTargetDrops: { params: { targets: RewardsTargetDrop[] }; response: RewardsAppState };
      setTargetDropSound: { params: { enabled: boolean }; response: RewardsAppState };
      setTargetDropVolume: { params: { volume: number }; response: RewardsAppState };
      previewTargetDropSound: { params: { sound: string }; response: { played: boolean } };
    };
  }>;
  webview: RPCSchema<{ messages: { stateChanged: RewardsAppState } }>;
};

export interface RewardsCatalogState {
  query: string;
  catalog: RewardsUiMob[];
  catalogCount: number;
}

export type RewardsCatalogRpc = {
  bun: RPCSchema<{
    requests: MaximizableWindowChromeRequests & {
      getState: { params: Record<string, never>; response: RewardsCatalogState };
      setQuery: { params: { query: string }; response: RewardsCatalogState };
    };
  }>;
  webview: RPCSchema<{ messages: { stateChanged: RewardsCatalogState } }>;
};
