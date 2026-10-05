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
  for (const slot of GEAR_SLOTS) {
    const gear = build.eq?.[slot];
    if (!gear) continue;
    add(gear.id, "equipment", slot);
    for (const card of gear.cards ?? []) add(card, "card", slot);
  }
  for (const [slot, artifact] of Object.entries(build.arti ?? {})) {
    if (!artifact) continue;
    add(artifact.id, "artifact", slot);
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
    for (const drop of world.drops[item.itemId] ?? []) {
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
