import type { RPCSchema } from "@svoverlay/contracts/rpc";
import type { WindowChromeRequests } from "@svoverlay/contracts/window-rpc";
import type { BuildGuideSkills } from "@svoverlay/contracts/build-guide";
import type { BuildSort } from "./spiritvalers-client.ts";

export interface BuildGuideLibraryRow {
  id: string;
  name: string;
  author: string;
  likes: number;
  comments: number;
  level?: number;
  updatedAt?: string;
}

export interface BuildGuideAttribute {
  name: string;
  current?: number;
  target: number;
}

export interface BuildGuideMapView {
  name: string;
  minLevel: number;
  maxLevel: number;
}

export type BuildGuideSourceView =
  | { kind: "drop"; monster: string; level: number; boss: boolean; chance: number; expectedKills: number; maps: BuildGuideMapView[] }
  | { kind: "craft"; crafter: string; map?: BuildGuideMapView; materials: Array<{ name: string; count: number }> };

export interface BuildGuideItemView {
  itemId: string;
  name: string;
  kind: string;
  icon?: string;
  need: number;
  have: number;
  slots: string[];
  sources: BuildGuideSourceView[];
}

export interface BuildGuideSelected {
  id: string;
  name: string;
  author: string;
  url: string;
  stages: string[];
  stage: number;
  level?: number;
  jobLevel?: number;
  attributes: BuildGuideAttribute[];
  skills: BuildGuideSkills;
  missing: BuildGuideItemView[];
  owned: BuildGuideItemView[];
}

export interface BuildGuideCharacter {
  name: string;
  cls: string;
  level: number;
  jobLevel: number;
}

export interface BuildGuideState {
  character?: BuildGuideCharacter;
  /** The class whose builds are listed: the character's, unless the player picked another. */
  className: string;
  classPicked: boolean;
  classes: string[];
  sort: BuildSort;
  library: BuildGuideLibraryRow[];
  libraryLoading: boolean;
  libraryError?: string;
  selected?: BuildGuideSelected;
  selectedLoading: boolean;
  selectedError?: string;
  /** The overlay follows the selected build. */
  guiding: boolean;
  siteOrigin: string;
}

type Empty = Record<string, never>;

export type BuildGuideRpc = {
  bun: RPCSchema<{
    requests: WindowChromeRequests & {
      getState: { params: Empty; response: BuildGuideState };
      setClass: { params: { className?: string }; response: BuildGuideState };
      setSort: { params: { sort: BuildSort }; response: BuildGuideState };
      selectBuild: { params: { id: string }; response: BuildGuideState };
      setStage: { params: { stage: number }; response: BuildGuideState };
      setGuiding: { params: { guiding: boolean }; response: BuildGuideState };
      refresh: { params: Empty; response: BuildGuideState };
      openOnSite: { params: Empty; response: void };
    };
  }>;
  webview: RPCSchema<{ messages: { stateChanged: BuildGuideState } }>;
};
