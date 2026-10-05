import bundledCatalog from "../../assets/catalog.json";
import { catalogKey, type CatalogEntry, type CatalogKind, type ItemCatalog } from "./item-catalog.ts";

const catalog = bundledCatalog as ItemCatalog;

/** An item's name and icon by its catalog kind and game id; an artifact also needs its slot ("Rune"). */
export function lookupCatalogItem(kind: CatalogKind, itemId: string, artifactSlot?: string): CatalogEntry | undefined {
  return catalog[catalogKey(kind, itemId, artifactSlot)];
}
