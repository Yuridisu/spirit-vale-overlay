import type { SiteClass, SiteSkill } from "./site-types.ts";

/** The game's skill window is always this grid, whatever squares a class fills. */
export const SKILL_GRID = { rows: 6, cols: 7 } as const;

/** One square of the class's skill grid, where the game draws it. */
export interface SkillCell {
  /** Zero-based, as the game lays the grid out. */
  row: number;
  col: number;
  gameId: string;
  slug: string;
  name: string;
  maxLevel: number;
  passive: boolean;
  current: number;
  /** The build's level, raised to what the build's other skills require of this one. */
  target: number;
  /** The build leaves this skill lower, but another skill it takes needs it at `target`. */
  required: boolean;
}

/** Raise one skill from one level to another. */
export interface SkillStep {
  gameId: string;
  name: string;
  from: number;
  to: number;
}

export interface SkillPlan {
  className: string;
  rows: number;
  cols: number;
  cells: SkillCell[];
  /** Points still to spend to reach the build. */
  pointsLeft: number;
  /** Skills above the build's level: points the build would put elsewhere. */
  overspent: SkillCell[];
  /** The order to spend the points in: requirements first, then the grid from the top left. */
  steps: SkillStep[];
}

/** One tab of the game's skill window: the base class's tree, then the advanced class's. */
export interface SkillTreePlan extends SkillPlan {
  /** Where this tree is in the window's tabs, from the left. */
  tab: number;
}

/**
 * The tabs the game shows for a class: an advanced class has its base class's tree first (Rogue,
 * then Shinobi); a class no other class leads to has only its own.
 */
export function skillTabs(classes: Readonly<Record<string, SiteClass>>, siteClass: SiteClass): SiteClass[] {
  const names = [siteClass.gameId, siteClass.slug, siteClass.displayName].map((name) => name.toLowerCase());
  const base = Object.values(classes).find((candidate) => candidate !== siteClass
    && candidate.advancedClasses.some((name) => names.includes(name.toLowerCase())));
  return base ? [base, siteClass] : [siteClass];
}

/** Plans every tab of the class, in tab order; points are spent in the base class's tree first. */
export function planSkillTabs(
  classes: Readonly<Record<string, SiteClass>>,
  siteClass: SiteClass,
  current: Readonly<Record<string, number>>,
  target: Readonly<Record<string, number>>,
): SkillTreePlan[] {
  return skillTabs(classes, siteClass).map((tree, tab) => ({ ...planSkills(tree, current, target), tab }));
}

/**
 * Lays the build's skill levels over the character's, on the class's own grid.
 *
 * @param current the character's skill levels by game skill id, as the packets report them.
 * @param target the build's skill levels by site slug.
 */
export function planSkills(siteClass: SiteClass, current: Readonly<Record<string, number>>, target: Readonly<Record<string, number>>): SkillPlan {
  const bySlug = new Map(siteClass.skills.map((skill) => [skill.id, skill]));
  const byGameId = new Map(siteClass.skills.map((skill) => [skill.gameId, skill]));
  const levelOf = (skill: SiteSkill): number => Math.max(0, Math.floor(current[skill.gameId] ?? 0));
  const buildLevel = (skill: SiteSkill): number => Math.max(0, Math.min(skill.maxLevel, Math.floor(target[skill.id] ?? 0)));
  // A skill the build takes needs its requirements at their level, even when the build lists them lower.
  const requiredLevel = new Map<string, number>();
  const require = (skill: SiteSkill, seen: Set<string>): void => {
    if (seen.has(skill.id)) return;
    seen.add(skill.id);
    for (const requirement of skill.requirements) {
      const needed = bySlug.get(requirement.id);
      if (!needed) continue;
      const level = Math.min(needed.maxLevel, requirement.level);
      requiredLevel.set(needed.id, Math.max(requiredLevel.get(needed.id) ?? 0, level));
      require(needed, seen);
    }
  };
  for (const skill of siteClass.skills) if (buildLevel(skill) > 0) require(skill, new Set());
  const targetOf = (skill: SiteSkill): number => Math.max(buildLevel(skill), requiredLevel.get(skill.id) ?? 0);

  const cells: SkillCell[] = [];
  const rowKeys = Object.keys(siteClass.gridLayout).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  let cols = 0;
  for (const [rowIndex, rowKey] of rowKeys.entries()) {
    const ids = siteClass.gridLayout[String(rowKey)] ?? [];
    cols = Math.max(cols, ids.length);
    for (const [col, gameId] of ids.entries()) {
      const skill = byGameId.get(gameId);
      if (!skill) continue;
      cells.push({
        row: rowIndex,
        col,
        gameId,
        slug: skill.id,
        name: skill.name,
        maxLevel: skill.maxLevel,
        passive: skill.isPassive,
        current: levelOf(skill),
        target: targetOf(skill),
        required: targetOf(skill) > buildLevel(skill),
      });
    }
  }

  // Spend in grid order, but a skill's requirements are raised to their level before it is.
  const planned = new Map(cells.map((cell) => [cell.slug, cell.current]));
  const steps: SkillStep[] = [];
  const visiting = new Set<string>();
  const ensure = (skill: SiteSkill, level: number): void => {
    if (visiting.has(skill.id)) return;
    visiting.add(skill.id);
    for (const requirement of skill.requirements) {
      const needed = bySlug.get(requirement.id);
      if (needed) ensure(needed, Math.min(needed.maxLevel, requirement.level));
    }
    visiting.delete(skill.id);
    const from = planned.get(skill.id) ?? 0;
    if (from >= level) return;
    planned.set(skill.id, level);
    const last = steps[steps.length - 1];
    if (last?.gameId === skill.gameId) last.to = level;
    else steps.push({ gameId: skill.gameId, name: skill.name, from, to: level });
  };
  for (const cell of cells) {
    if (cell.target > cell.current) ensure(bySlug.get(cell.slug)!, cell.target);
  }

  return {
    className: siteClass.displayName,
    rows: Math.max(SKILL_GRID.rows, rowKeys.length),
    cols: Math.max(SKILL_GRID.cols, cols),
    cells,
    pointsLeft: steps.reduce((total, step) => total + step.to - step.from, 0),
    overspent: cells.filter((cell) => cell.current > cell.target),
    steps,
  };
}
