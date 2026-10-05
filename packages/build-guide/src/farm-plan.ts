import type { SiteBuildParts, SiteMap, SiteWorldData, SiteWorldTile } from "./site-types.ts";

export type NeededKind = "equipment" | "card" | "gem" | "artifact" | "grimoire";

/** An item the build uses, with how many of it. */
export interface NeededItem {
  itemId: string;
  kind: NeededKind;
  count: number;
  /** Where it goes: "head", "mainhand", "rune"… */
  slots: string[];
}

/** A map, with its square on the world map when it has one. */
export interface MapRef {
  slug: string;
  name: string;
  minLevel: number;
  maxLevel: number;
  tile?: { row: number; col: number };
}

export type ItemSource =
  | { kind: "drop"; monster: string; monsterSlug: string; level: number; boss: boolean; chance: number; expectedKills: number; maps: MapRef[] }
  | { kind: "craft"; crafter: string; map?: MapRef; materials: Array<{ id: string; count: number }> };

export interface FarmItem extends NeededItem {
  have: number;
  /** Drops first, best chance first, then recipes. Empty when the site knows no source. */
  sources: ItemSource[];
}

export interface FarmPlan {
  /** Everything the build uses that the character does not have enough of. */
  missing: FarmItem[];
  /** What the build uses and the character already has. */
  owned: FarmItem[];
  /** The world-map squares where the missing items drop, each with what drops there. */
  squares: Array<{ map: MapRef; items: string[] }>;
}

const GEAR_SLOTS = ["mainhand", "offhand", "head", "eyewear", "chest", "back", "legs", "feet", "acc1", "acc2"];
/** Artifact slots as the build names them, in the game's slot order. */
export const ARTIFACT_SLOTS = ["rune", "jewel", "scroll", "relic"] as const;

/** Every item a build (or one of its stages) uses: gear, the cards in it, artifacts and their gems. */
export function neededItems(build: SiteBuildParts): NeededItem[] {
  const items = new Map<string, NeededItem>();
  const add = (itemId: string | undefined, kind: NeededKind, slot: string): void => {
    if (!itemId) return;
    const key = `${kind}:${itemId}`;
    const item = items.get(key);
    if (item) {
      item.count += 1;
      item.slots.push(slot);
    } else items.set(key, { itemId, kind, count: 1, slots: [slot] });
  };
  const addArtifact = (itemId: string | undefined, slot: string): void => {
    if (itemId) items.set(`artifact:${itemId}:${slot}`, { itemId, kind: "artifact", count: 1, slots: [slot] });
  };
  for (const slot of GEAR_SLOTS) {
    const gear = build.eq?.[slot];
    if (!gear) continue;
    add(gear.id, "equipment", slot);
    for (const card of gear.cards ?? []) add(card, "card", slot);
  }
  for (const slot of ARTIFACT_SLOTS) {
    const artifact = build.arti?.[slot];
    if (!artifact) continue;
    addArtifact(artifact.id, slot);
    add(artifact.gem, "gem", slot);
  }
  for (const grimoire of build.grim ?? []) add(grimoire, "grimoire", "grimoire");
  return [...items.values()];
}

/**
 * Where to get each item the build needs and the character lacks.
 *
 * @param have how many of an item the character already owns (worn or carried).
 */
export function planFarm(needed: readonly NeededItem[], have: (item: NeededItem) => number, world: SiteWorldData): FarmPlan {
  const mapsBySlug = new Map(world.maps.map((map) => [map.slug, map]));
  const tilesBySlug = new Map<string, SiteWorldTile>();
  for (const tile of world.worldmap.tiles) if (!tilesBySlug.has(tile.our)) tilesBySlug.set(tile.our, tile);
  const mapsByName = new Map(world.maps.map((map) => [map.id, map]));
  // Artifacts drop by piece and slot, from the monster table rather than the drop table.
  const artifactDrops = new Map<string, Array<{ monster: string; slug: string; level: number; boss: boolean; chance: number }>>();
  for (const monster of world.monsters) {
    const artifact = monster.drops?.artifact;
    if (!artifact?.id) continue;
    for (const slot of artifact.slots ?? []) {
      const key = `${artifact.id}:${slot}`;
      const list = artifactDrops.get(key) ?? [];
      list.push({ monster: monster.name, slug: monster.slug, level: monster.level, boss: monster.boss, chance: artifact.chance });
      artifactDrops.set(key, list);
    }
  }
  const dropsFor = (item: NeededItem) => {
    if (item.kind !== "artifact") return world.drops[item.itemId] ?? [];
    const slot = ARTIFACT_SLOTS.indexOf(item.slots[0] as typeof ARTIFACT_SLOTS[number]);
    return artifactDrops.get(`${item.itemId}:${slot}`) ?? [];
  };
  const mapRef = (slug: string, name?: string): MapRef => {
    const map: SiteMap | undefined = mapsBySlug.get(slug);
    const tile = tilesBySlug.get(slug);
    return {
      slug,
      name: map?.name ?? name ?? slug,
      minLevel: map?.minLevel ?? tile?.minL ?? 0,
      maxLevel: map?.maxLevel ?? tile?.maxL ?? 0,
      ...(tile ? { tile: { row: tile.row, col: tile.col } } : {}),
    };
  };

  const missing: FarmItem[] = [];
  const owned: FarmItem[] = [];
  for (const item of needed) {
    const count = Math.max(0, have(item));
    const sources: ItemSource[] = [];
    for (const drop of dropsFor(item)) {
      if (!(drop.chance > 0)) continue;
      sources.push({
        kind: "drop",
        monster: drop.monster,
        monsterSlug: drop.slug,
        level: drop.level,
        boss: drop.boss,
        chance: drop.chance,
        expectedKills: Math.ceil(100 / drop.chance),
        maps: (world.spawns[drop.slug] ?? []).map((spawn) => mapRef(spawn.slug, spawn.map)),
      });
    }
    sources.sort((a, b) => (a.kind === "drop" && b.kind === "drop" ? b.chance - a.chance || a.level - b.level : 0));
    for (const recipe of world.crafting.byResult[item.itemId] ?? []) {
      const crafterMap = mapsByName.get(recipe.crafterId) ?? mapsByName.get(recipe.crafter);
      sources.push({ kind: "craft", crafter: recipe.crafter, ...(crafterMap ? { map: mapRef(crafterMap.slug) } : {}), materials: recipe.materials });
    }
    (count >= item.count ? owned : missing).push({ ...item, have: count, sources });
  }

  // Each square once, with every missing item that drops on it.
  const squares = new Map<string, { map: MapRef; items: string[] }>();
  for (const item of missing) {
    for (const source of item.sources) {
      if (source.kind !== "drop") continue;
      for (const map of source.maps) {
        const square = squares.get(map.slug) ?? { map, items: [] };
        if (!square.items.includes(item.itemId)) square.items.push(item.itemId);
        squares.set(map.slug, square);
      }
    }
  }
  return { missing, owned, squares: [...squares.values()].sort((a, b) => b.items.length - a.items.length || a.map.minLevel - b.map.minLevel) };
}
