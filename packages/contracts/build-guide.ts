/** What the overlay draws for the build the player chose in the Build Guide window. */

/** One square of the class's skill grid, where the game draws it (zero-based). */
export interface BuildGuideSkillCell {
  row: number;
  col: number;
  gameId: string;
  name: string;
  /** The game's icon name, under `views://assets/status-icons/`. */
  sprite?: string;
  current: number;
  target: number;
  maxLevel: number;
  /** Raised only because another skill of the build needs it. */
  required: boolean;
}

export interface BuildGuideSkillStep {
  gameId: string;
  name: string;
  sprite?: string;
  from: number;
  to: number;
  /** Which tab of the skill window the skill is on. */
  tab: number;
}

/** One tab of the game's skill window, on its fixed grid. */
export interface BuildGuideSkillTree {
  className: string;
  rows: number;
  cols: number;
  cells: BuildGuideSkillCell[];
  pointsLeft: number;
}

export interface BuildGuideSkills {
  /** The skill window's tabs, left to right: a base class's tree, then the advanced class's. */
  trees: BuildGuideSkillTree[];
  pointsLeft: number;
  /** The next few raises, in order. */
  next: BuildGuideSkillStep[];
}

/** The best place to get one missing item. */
export interface BuildGuideFarmItem {
  itemId: string;
  name: string;
  kind: string;
  icon?: string;
  need: number;
  have: number;
  /** Where it best drops, when it drops at all. */
  monster?: string;
  monsterLevel?: number;
  boss?: boolean;
  /** Percent. */
  chance?: number;
  expectedKills?: number;
  map?: string;
  /** One-based row and column on the world map. */
  square?: { row: number; col: number };
  /** Set when the item is made rather than dropped. */
  craftedAt?: string;
}

/** A world-map square where missing items drop. */
export interface BuildGuideSquare {
  name: string;
  row: number;
  col: number;
  minLevel: number;
  maxLevel: number;
  items: number;
}

export interface BuildGuideFarm {
  items: BuildGuideFarmItem[];
  squares: BuildGuideSquare[];
  /** Every square of the world map with its name, to line the grid up with the game's map. */
  tiles: Array<{ name: string; row: number; col: number }>;
  /** The world map's grid, one-based: rows 1..rows, cols 1..cols. */
  grid: { rows: number; cols: number };
}

export interface OverlayBuildGuideState {
  buildName: string;
  author: string;
  stageName?: string;
  className: string;
  skills: BuildGuideSkills;
  farm: BuildGuideFarm;
}
