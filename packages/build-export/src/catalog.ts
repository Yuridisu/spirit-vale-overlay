
import { resolveFishNetItem } from "@kar-mi/spirit-vale-tools-items";
import snapshotJson from "./catalog/snapshot.json" with { type: "json" };
import type { BuildExportSnapshot, SnapshotClass } from "./snapshot-types.ts";

export * from "./snapshot-types.ts";

export const snapshot = snapshotJson as unknown as BuildExportSnapshot;

/** A set of item ids the planner knows. */
export interface KnownIds {
  has(id: string): boolean;
}

export interface BuildExportCatalog {
  snapshot: BuildExportSnapshot;
  grimoires: KnownIds;
  cards: KnownIds;
  gems: KnownIds;
  artifacts: KnownIds;
  classesByGameId: Record<string, SnapshotClass>;
}

const ITEM_TYPE = { EQUIPMENT: 2, ARTIFACT: 3, CARD: 4, GEM: 5 } as const;
/** Grimoires are equipment in the item catalog, named for their class ("Wizard_10"). */
const GRIMOIRE_ID = /^[A-Za-z]+_\d+$/;

/**
 * The bundled snapshot is a dated copy of the site's catalogs. Items the game added since (class
 * artifacts such as Wizard_Artifact_1, the advanced classes' grimoires) are known to the overlay's
 * own item catalog, which follows the current game build, and the site uses the same ids.
 */
function withCurrentItems(ids: readonly string[], itemType: number, accept: (id: string) => boolean = () => true): KnownIds {
  const listed = new Set(ids);
  return {
    has: (id) => {
      if (listed.has(id)) return true;
      try { return Boolean(resolveFishNetItem(itemType, id)) && accept(id); } catch { return false; }
    },
  };
}

let cached: BuildExportCatalog | undefined;

export function buildExportCatalog(source: BuildExportSnapshot = snapshot): BuildExportCatalog {
  if (source === snapshot && cached) return cached;
  const catalog: BuildExportCatalog = {
    snapshot: source,
    grimoires: source === snapshot
      ? withCurrentItems(source.grimoires, ITEM_TYPE.EQUIPMENT, (id) => GRIMOIRE_ID.test(id) && !source.equipment[id])
      : new Set(source.grimoires),
    cards: source === snapshot ? withCurrentItems(source.cards, ITEM_TYPE.CARD) : new Set(source.cards),
    gems: source === snapshot ? withCurrentItems(source.gems, ITEM_TYPE.GEM) : new Set(source.gems),
    artifacts: source === snapshot ? withCurrentItems(source.artifacts, ITEM_TYPE.ARTIFACT) : new Set(source.artifacts),
    classesByGameId: Object.fromEntries(source.classes.map((entry) => [entry.gameId, entry])),
  };
  if (source === snapshot) cached = catalog;
  return catalog;
}
