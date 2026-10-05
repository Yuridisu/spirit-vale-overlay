import { loadJsonSettings, writeJsonFileAtomic } from "@svoverlay/desktop-platform/json-settings";
import type { BuildGuideFarmItem, OverlayBuildGuideState } from "@svoverlay/contracts/build-guide";
import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";

import type { BuildGuideItemView, BuildGuideSelected, BuildGuideSourceView, BuildGuideState } from "./app-types.ts";
import { neededItems, planFarm, type FarmItem, type FarmPlan, type MapRef, type NeededItem, type NeededKind } from "./farm-plan.ts";
import { planSkillTabs, type SkillTreePlan } from "./skill-plan.ts";
import type { SiteBuildData, SiteBuildParts, SiteBuildRow, SiteClass, SiteWorldData } from "./site-types.ts";
import { SPIRITVALERS_ORIGIN, type BuildSort, type SpiritValersClient } from "./spiritvalers-client.ts";

/** What the player chose, kept in `data/settings/build-guide.json`. */
export interface BuildGuideSettings {
  schemaVersion: 1;
  /** A class picked by hand; otherwise the character's own. */
  className?: string;
  sort: BuildSort;
  buildId?: string;
  stage: number;
  guiding: boolean;
}

const SORTS: readonly BuildSort[] = ["trending", "liked", "recent"];

export function normalizeBuildGuideSettings(value: unknown): BuildGuideSettings {
  const source = value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (field: unknown, max: number) => (typeof field === "string" && field.trim() && field.length <= max ? field.trim() : undefined);
  const className = text(source.className, 40);
  const buildId = text(source.buildId, 40);
  return {
    schemaVersion: 1,
    ...(className ? { className } : {}),
    sort: SORTS.includes(source.sort as BuildSort) ? source.sort as BuildSort : "trending",
    ...(buildId ? { buildId } : {}),
    stage: typeof source.stage === "number" && Number.isInteger(source.stage) && source.stage >= 0 && source.stage < 100 ? source.stage : 0,
    guiding: source.guiding === true,
  };
}

export interface ItemInfo {
  name: string;
  icon?: string;
}

export interface BuildGuideServiceOptions {
  client: SpiritValersClient;
  settingsPath: string;
  getCharacter: () => CharacterSnapshot | undefined;
  subscribeCharacter: (listener: () => void) => () => void;
  /** How many of an item the player keeps outside their worn gear (bag and storage). */
  ownedElsewhere?: (item: NeededItem) => number;
  itemInfo?: (kind: NeededKind | "material", itemId: string, slot?: string) => ItemInfo | undefined;
  skillSprite?: (gameId: string) => string | undefined;
  onWarning?: (message: string) => void;
}

export interface BuildGuideService {
  start(): Promise<void>;
  stop(): void;
  state(): BuildGuideState;
  /** Null unless the player asked the overlay to follow a build. */
  overlayState(): OverlayBuildGuideState | null;
  subscribe(listener: () => void): () => void;
  setClass(className: string | undefined): Promise<void>;
  setSort(sort: BuildSort): Promise<void>;
  selectBuild(id: string): Promise<void>;
  setStage(stage: number): void;
  setGuiding(guiding: boolean): void;
  refresh(): Promise<void>;
  siteUrl(): string | undefined;
}

const NEXT_STEPS = 6;
const FARM_ITEMS = 12;

export function createBuildGuideService(options: BuildGuideServiceOptions): BuildGuideService {
  let settings: BuildGuideSettings = normalizeBuildGuideSettings({});
  let classes: Record<string, SiteClass> = {};
  let world: SiteWorldData | undefined;
  let library: SiteBuildRow[] = [];
  let libraryClass: string | undefined;
  // Loading until the first list arrives, so the window says so rather than looking empty.
  let libraryLoading = true;
  let libraryError: string | undefined;
  let build: { id: string; name: string; author: string; data: SiteBuildData } | undefined;
  let buildLoading = false;
  let buildError: string | undefined;
  let plans: { skills?: SkillTreePlan[]; farm?: FarmPlan; parts?: SiteBuildParts } = {};
  const listeners = new Set<() => void>();
  let unsubscribeCharacter: (() => void) | undefined;
  let stopped = false;

  const emit = () => { for (const listener of listeners) listener(); };
  const save = () => {
    void writeJsonFileAtomic(options.settingsPath, settings).catch((error: unknown) => {
      options.onWarning?.(`Build guide settings could not be saved: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const characterClass = (): string | undefined => {
    const archetypes = options.getCharacter()?.archetypes ?? [];
    for (let index = archetypes.length - 1; index >= 0; index -= 1) {
      const name = archetypes[index]!;
      if (classes[name]) return name;
    }
    return undefined;
  };
  const className = (): string => settings.className ?? characterClass() ?? Object.keys(classes)[0] ?? "";

  /** The parts of the build that apply: the chosen stage over the build's own fields. */
  const activeParts = (): SiteBuildParts | undefined => {
    if (!build) return undefined;
    const stages = build.data.stages ?? [];
    const stage = stages[settings.stage];
    return stage ? { ...build.data, ...stage } : build.data;
  };

  const recompute = () => {
    const parts = activeParts();
    const siteClass = classes[parts?.cls ?? ""] ?? classes[className()];
    if (!parts || !siteClass) {
      plans = {};
      return;
    }
    const character = options.getCharacter();
    const current: Record<string, number> = {};
    for (const skill of character?.skills ?? []) current[skill.id] = Math.max(current[skill.id] ?? 0, skill.level);
    const skills = planSkillTabs(classes, siteClass, current, parts.skills ?? {});
    const farm = world ? planFarm(neededItems(parts), (item) => ownedCount(item, character), world) : undefined;
    plans = { skills, farm, parts };
  };

  const ownedCount = (item: NeededItem, character: CharacterSnapshot | undefined): number => {
    let count = options.ownedElsewhere?.(item) ?? 0;
    if (!character) return count;
    if (item.kind === "equipment") count += character.equipment.filter((piece) => piece.itemId === item.itemId).length;
    if (item.kind === "card") {
      count += character.equipment.reduce((total, piece) => total + piece.cards.filter((card) => card === item.itemId).length, 0);
    }
    if (item.kind === "artifact") {
      const slot = item.slots[0];
      count += character.artifacts.filter((piece) => piece.itemId === item.itemId && piece.slot.toLowerCase() === slot).length;
    }
    if (item.kind === "gem") {
      count += character.artifacts.reduce((total, piece) => total + piece.gems.filter((gem) => gem.id === item.itemId).length, 0);
    }
    if (item.kind === "grimoire") count += (character.grimoires ?? []).filter((piece) => piece.itemId === item.itemId).length;
    return count;
  };

  const info = (kind: NeededKind | "material", itemId: string, slot?: string): ItemInfo => options.itemInfo?.(kind, itemId, slot) ?? { name: itemId };
  const mapView = (map: MapRef) => ({ name: map.name, minLevel: map.minLevel, maxLevel: map.maxLevel });
  const itemView = (item: FarmItem): BuildGuideItemView => {
    const { name, icon } = info(item.kind, item.itemId, item.slots[0]);
    const sources: BuildGuideSourceView[] = item.sources.map((source) => source.kind === "drop"
      ? { kind: "drop", monster: source.monster, level: source.level, boss: source.boss, chance: source.chance, expectedKills: source.expectedKills, maps: source.maps.map(mapView) }
      : { kind: "craft", crafter: source.crafter, ...(source.map ? { map: mapView(source.map) } : {}), materials: source.materials.map((material) => ({ name: info("material", material.id).name, count: material.count })) });
    return { itemId: item.itemId, name, kind: item.kind, ...(icon ? { icon } : {}), need: item.count, have: item.have, slots: item.slots, sources };
  };


  const skillsView = (trees: SkillTreePlan[], count?: number) => ({
    trees: trees.map((tree) => ({
      className: tree.className,
      rows: tree.rows,
      cols: tree.cols,
      pointsLeft: tree.pointsLeft,
      cells: tree.cells.map((cell) => ({
        row: cell.row, col: cell.col, gameId: cell.gameId, name: cell.name, current: cell.current, target: cell.target,
        maxLevel: cell.maxLevel, required: cell.required, ...withSprite(cell.gameId),
      })),
    })),
    pointsLeft: trees.reduce((total, tree) => total + tree.pointsLeft, 0),
    next: trees.flatMap((tree) => tree.steps.map((step) => ({ ...step, tab: tree.tab, ...withSprite(step.gameId) }))).slice(0, count),
  });
  const withSprite = (gameId: string) => {
    const sprite = options.skillSprite?.(gameId);
    return sprite ? { sprite } : {};
  };

  const selectedView = (): BuildGuideSelected | undefined => {
    const parts = activeParts();
    if (!build || !parts || !plans.skills) return undefined;
    const character = options.getCharacter();
    const attributes = Object.entries(parts.attr ?? {}).map(([name, target]) => ({
      name, target, ...(character ? { current: character.attributes[name as keyof CharacterSnapshot["attributes"]] } : {}),
    }));
    return {
      id: build.id,
      name: build.name,
      author: build.author,
      url: options.client.buildUrl(build.id),
      stages: (build.data.stages ?? []).map((stage, index) => stage.name?.trim() || `Stage ${index + 1}`),
      stage: settings.stage,
      ...(parts.lv ? { level: parts.lv } : {}),
      ...(parts.job ? { jobLevel: parts.job } : {}),
      attributes,
      skills: skillsView(plans.skills),
      missing: plans.farm?.missing.map(itemView) ?? [],
      owned: plans.farm?.owned.map(itemView) ?? [],
    };
  };

  const loadLibrary = async () => {
    const name = className();
    if (!name) {
      libraryLoading = false;
      emit();
      return;
    }
    libraryClass = name;
    libraryLoading = true;
    libraryError = undefined;
    emit();
    try {
      const rows = await options.client.library(name, settings.sort);
      if (libraryClass !== name) return;
      library = rows;
    } catch (error) {
      if (libraryClass === name) libraryError = message(error);
    } finally {
      if (libraryClass === name) libraryLoading = false;
      emit();
    }
  };

  const loadBuild = async (id: string) => {
    buildLoading = true;
    buildError = undefined;
    emit();
    try {
      const loaded = await options.client.build(id);
      if (settings.buildId !== id) return;
      build = loaded;
      if (settings.stage >= (loaded.data.stages?.length ?? 0) && settings.stage !== 0) settings = { ...settings, stage: 0 };
      recompute();
    } catch (error) {
      if (settings.buildId === id) buildError = message(error);
    } finally {
      if (settings.buildId === id) buildLoading = false;
      emit();
    }
  };

  return {
    async start() {
      settings = await loadJsonSettings(options.settingsPath, normalizeBuildGuideSettings, () => normalizeBuildGuideSettings({}));
      unsubscribeCharacter = options.subscribeCharacter(() => {
        const before = libraryClass;
        recompute();
        if (!settings.className && className() !== before) void loadLibrary();
        else emit();
      });
      // The skill trees are all the list needs; the much larger drop and map data follow on their own,
      // and the farming plan fills in when they arrive.
      const worldLoad = options.client.world().then((loaded) => {
        world = loaded;
        recompute();
        emit();
      }, (error: unknown) => {
        options.onWarning?.(`Build guide drop data could not be loaded: ${message(error)}`);
      });
      try {
        classes = await options.client.classes();
      } catch (error) {
        libraryError = message(error);
        libraryLoading = false;
        options.onWarning?.(`Build guide data could not be loaded: ${libraryError}`);
        emit();
      }
      if (stopped) return;
      await Promise.all([loadLibrary(), settings.buildId ? loadBuild(settings.buildId) : Promise.resolve(), worldLoad]);
    },
    stop() {
      stopped = true;
      unsubscribeCharacter?.();
      listeners.clear();
    },
    state() {
      const character = options.getCharacter();
      const cls = characterClass();
      const view = selectedView();
      return {
        ...(character ? { character: { name: character.name, cls: cls ?? character.archetypes.at(-1) ?? "", level: character.level, jobLevel: character.jobLevel } } : {}),
        className: className(),
        classPicked: settings.className !== undefined,
        classes: Object.keys(classes),
        sort: settings.sort,
        library: library.map((row) => ({
          id: row.id, name: row.name, author: row.author, likes: row.likes ?? 0, comments: row.comments ?? 0,
          ...(row.lv ? { level: row.lv } : {}), ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
        })),
        libraryLoading,
        ...(libraryError ? { libraryError } : {}),
        ...(view ? { selected: view } : {}),
        selectedLoading: buildLoading,
        ...(buildError ? { selectedError: buildError } : {}),
        guiding: settings.guiding && view !== undefined,
        siteOrigin: SPIRITVALERS_ORIGIN,
      };
    },
    overlayState() {
      const parts = activeParts();
      if (!settings.guiding || !build || !parts || !plans.skills) return null;
      const items: BuildGuideFarmItem[] = (plans.farm?.missing ?? []).slice(0, FARM_ITEMS).map((item) => {
        const { name, icon } = info(item.kind, item.itemId, item.slots[0]);
        const best = item.sources.find((source) => source.kind === "drop");
        const craft = item.sources.find((source) => source.kind === "craft");
        const map = best?.kind === "drop" ? best.maps.find((candidate) => candidate.tile) ?? best.maps[0] : undefined;
        return {
          itemId: item.itemId, name, kind: item.kind, ...(icon ? { icon } : {}), need: item.count, have: item.have,
          ...(best?.kind === "drop" ? { monster: best.monster, monsterLevel: best.level, boss: best.boss, chance: best.chance, expectedKills: best.expectedKills } : {}),
          ...(map ? { map: map.name } : {}),
          ...(!best && craft?.kind === "craft" ? { craftedAt: craft.crafter } : {}),
        };
      });
      return {
        buildName: build.name,
        author: build.author,
        ...(build.data.stages?.[settings.stage]?.name ? { stageName: build.data.stages[settings.stage]!.name! } : {}),
        className: plans.skills.at(-1)?.className ?? className(),
        skills: skillsView(plans.skills, NEXT_STEPS),
        farm: {
          items,
        },
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async setClass(name) {
      const next = name && classes[name] ? name : undefined;
      settings = { ...settings, ...(next ? { className: next } : {}) };
      if (!next) delete settings.className;
      save();
      library = [];
      await loadLibrary();
    },
    async setSort(sort) {
      if (!SORTS.includes(sort)) return;
      settings = { ...settings, sort };
      save();
      await loadLibrary();
    },
    async selectBuild(id) {
      if (settings.buildId === id && build?.id === id) return;
      settings = { ...settings, buildId: id, stage: 0 };
      save();
      build = undefined;
      plans = {};
      await loadBuild(id);
    },
    setStage(stage) {
      const count = build?.data.stages?.length ?? 0;
      if (!Number.isInteger(stage) || stage < 0 || (count > 0 && stage >= count)) return;
      settings = { ...settings, stage };
      save();
      recompute();
      emit();
    },
    setGuiding(guiding) {
      settings = { ...settings, guiding };
      save();
      emit();
    },
    async refresh() {
      await Promise.all([loadLibrary(), settings.buildId ? loadBuild(settings.buildId) : Promise.resolve()]);
    },
    siteUrl() {
      return build ? options.client.buildUrl(build.id) : undefined;
    },
  };
}
