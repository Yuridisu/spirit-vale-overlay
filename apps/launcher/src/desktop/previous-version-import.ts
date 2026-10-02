import { existsSync, readdirSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

import { isNewerVersion } from "../launcher/update-check.ts";

/** The folder name a release ZIP extracts to, for either desktop shell. */
const RELEASE_FOLDER = /^spirit-vale-overlay(?:-electron)?-windows-x64-v(\d+\.\d+\.\d+)$/i;

/** What a player would miss if it were left behind. Logs and runtime caches are not carried over. */
const CARRIED_OVER = [
  "settings",
  "companion",
  "character.json",
  "actor-identities.json",
  "boss-timers.json",
  "boss-fights.json",
  "inspected-characters.sqlite",
];

export interface PreviousVersionImport {
  /** The folder the data was copied from. */
  from: string;
  version: string;
}

/**
 * Carries a player's data over from the release folder beside this one.
 *
 * Each release extracts to its own folder and keeps its data inside it, so a player who extracts a
 * new version next to the old one would start over with default settings. When this folder has no
 * settings yet, the newest sibling release folder that does have some is copied from. A folder
 * that already has settings is never touched.
 */
export async function importFromPreviousVersion(root: string): Promise<PreviousVersionImport | undefined> {
  const resolved = path.resolve(root);
  if (!RELEASE_FOLDER.test(path.basename(resolved))) return undefined;
  if (hasSettings(resolved)) return undefined;

  let source: { directory: string; version: string } | undefined;
  for (const entry of siblings(resolved)) {
    const version = RELEASE_FOLDER.exec(entry.name)?.[1];
    if (version === undefined || !hasSettings(entry.directory)) continue;
    if (!source || isNewerVersion(version, source.version)) source = { directory: entry.directory, version };
  }
  if (!source) return undefined;

  const from = path.join(source.directory, "data");
  const to = path.join(resolved, "data");
  await mkdir(to, { recursive: true });
  for (const name of CARRIED_OVER) {
    const item = path.join(from, name);
    if (!existsSync(item)) continue;
    await cp(item, path.join(to, name), {
      recursive: true,
      force: true,
      // The companion keeps its log beside its data; a log belongs to the folder that wrote it.
      filter: (file) => path.basename(file) !== "logs",
    });
  }
  return { from: source.directory, version: source.version };
}

function hasSettings(root: string): boolean {
  try {
    return readdirSync(path.join(root, "data", "settings")).some((name) => name.endsWith(".json"));
  } catch {
    return false;
  }
}

function siblings(root: string): Array<{ name: string; directory: string }> {
  const parent = path.dirname(root);
  try {
    return readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ name: entry.name, directory: path.join(parent, entry.name) }))
      .filter((entry) => entry.directory.toLowerCase() !== root.toLowerCase());
  } catch {
    return [];
  }
}
