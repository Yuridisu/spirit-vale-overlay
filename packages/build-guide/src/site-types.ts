/**
 * The shapes spiritvalers.com serves, reduced to the fields the build guide reads. The site belongs
 * to Buh (bjb2); builds belong to the players who published them and are always shown with their
 * author and a link back.
 */

/** One class from `/spiritvale-all-classes.json`. */
export interface SiteClass {
  slug: string;
  /** The game's class name, as in the packets ("Weaver"). */
  gameId: string;
  displayName: string;
  type: string;
  maxJobLevel: number;
  advancedClasses: string[];
  /** Row index (as a string) to the game skill ids in that row, in the game's own layout. */
  gridLayout: Record<string, string[]>;
  skills: SiteSkill[];
}

export interface SiteSkill {
  position: { row: number; col: number };
  /** The site's slug ("ice-shard"), the key builds use. */
  id: string;
  /** The game's skill id ("IceShard"), the key the packets use. */
  gameId: string;
  name: string;
  maxLevel: number;
  isPassive: boolean;
  requirements: Array<{ id: string; name?: string; level: number }>;
}

/** A row of `/api/builds?shape=library`. */
export interface SiteBuildRow {
  id: string;
  name: string;
  author: string;
  cls: string;
  classes?: string[];
  lv?: number;
  likes?: number;
  comments?: number;
  updated_at?: string;
  desc?: string;
  stats?: Record<string, number>;
}

export interface SiteGear {
  id: string;
  refine?: number;
  cards?: string[];
}

export interface SiteArtifact {
  id: string;
  refine?: number;
  gem?: string;
  gemRefine?: number;
}

/** The parts of a build, or of one of its stages, the guide reads. */
export interface SiteBuildParts {
  name?: string;
  cls?: string;
  base?: string;
  lv?: number;
  job?: number;
  attr?: Record<string, number>;
  /** Skill slug to level. */
  skills?: Record<string, number>;
  eq?: Record<string, SiteGear | null | undefined>;
  arti?: Record<string, SiteArtifact | null | undefined>;
  grim?: string[];
}

/** The `data` of `/rest/v1/builds?id=eq.<id>`. */
export interface SiteBuildData extends SiteBuildParts {
  author?: string;
  overview?: string;
  stages?: SiteBuildParts[];
}

export interface SiteDrop {
  monster: string;
  slug: string;
  /** Percent. */
  chance: number;
  level: number;
  boss: boolean;
}

/** Item id to the monsters that drop it. */
export type SiteDrops = Record<string, SiteDrop[]>;

/** Monster slug to the maps it spawns on. */
export type SiteSpawns = Record<string, Array<{ map: string; slug: string; boss: boolean }>>;

export interface SiteMap {
  id: string;
  name: string;
  slug: string;
  type: number;
  minLevel: number;
  maxLevel: number;
  bossRespawn?: number;
}

/** One square of the in-game world map, by its row and column on the map's grid. */
export interface SiteWorldTile {
  name: string;
  row: number;
  col: number;
  minL: number;
  maxL: number;
  boss: boolean;
  /** Has a waypoint. */
  wp: boolean;
  /** The map slug. */
  our: string;
  conn: string[];
}

export interface SiteWorldMap {
  tiles: SiteWorldTile[];
}

export interface SiteRecipe {
  crafter: string;
  crafterId: string;
  kind: string;
  materials: Array<{ id: string; count: number }>;
}

export interface SiteCrafting {
  byResult: Record<string, SiteRecipe[]>;
}

/** Everything the farming plan needs, loaded together. */
export interface SiteWorldData {
  drops: SiteDrops;
  spawns: SiteSpawns;
  maps: SiteMap[];
  worldmap: SiteWorldMap;
  crafting: SiteCrafting;
}
