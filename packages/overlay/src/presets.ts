import path from "node:path";
import { loadJsonSettings, writeJsonFileAtomic } from "@svoverlay/desktop-platform/json-settings";

import type { OverlaySettings } from "./settings.ts";

/** How many presets can be kept. */
export const MAX_PRESETS = 12;
export const MAX_PRESET_NAME_LENGTH = 40;

/**
 * What a preset remembers: how the overlay looks and what it follows. Whether it is locked, the
 * hotkeys, the home display and auto-hide are the player's working setup rather than a layout,
 * so switching presets leaves them alone.
 */
const PRESET_KEYS = [
  "elements",
  "meterStatType",
  "personalDpsMode",
  "requiredStatuses",
  "minimapEnabled",
  "minimapRarityFilter",
  "minimapLootChanceFilter",
  "minimapRange",
  "timerMode",
  "timerDurationSeconds",
  "itemCounterItems",
  "targetDrops",
  "targetDropSound",
  "targetDropVolume",
] as const satisfies ReadonlyArray<keyof OverlaySettings>;

export type OverlayPresetSettings = Pick<OverlaySettings, typeof PRESET_KEYS[number]>;

export interface OverlayPreset {
  name: string;
  settings: OverlayPresetSettings;
}

export interface OverlayPresetStore {
  /** The preset last saved or applied. The overlay may have been changed since. */
  active?: string;
  presets: OverlayPreset[];
}

/** The part of the current settings a preset keeps, copied so later edits do not reach into it. */
export function presetSettings(settings: OverlaySettings): OverlayPresetSettings {
  const picked = {} as Record<string, unknown>;
  for (const key of PRESET_KEYS) picked[key] = structuredClone(settings[key]);
  return picked as OverlayPresetSettings;
}

/** A name fit to show and to look a preset up by, or undefined when there is nothing left of it. */
export function normalizePresetName(name: unknown): string | undefined {
  if (typeof name !== "string") return undefined;
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, MAX_PRESET_NAME_LENGTH).trim();
  return trimmed || undefined;
}

export function findPreset(store: OverlayPresetStore, name: string): OverlayPreset | undefined {
  const key = name.toLowerCase();
  return store.presets.find((preset) => preset.name.toLowerCase() === key);
}

/**
 * Saves the settings under the name and makes it the active preset. A name already in use, in any
 * case, is overwritten in place; a new one goes last. Returns undefined when the name is empty or
 * there is no room for another preset.
 */
export function savePreset(store: OverlayPresetStore, name: unknown, settings: OverlayPresetSettings): OverlayPresetStore | undefined {
  const normalized = normalizePresetName(name);
  if (!normalized) return undefined;
  const existing = findPreset(store, normalized);
  if (!existing && store.presets.length >= MAX_PRESETS) return undefined;
  const preset = { name: existing?.name ?? normalized, settings };
  return {
    active: preset.name,
    presets: existing
      ? store.presets.map((candidate) => candidate === existing ? preset : candidate)
      : [...store.presets, preset],
  };
}

export function deletePreset(store: OverlayPresetStore, name: string): OverlayPresetStore {
  const target = findPreset(store, name);
  if (!target) return store;
  const active = store.active !== undefined && store.active.toLowerCase() === target.name.toLowerCase() ? undefined : store.active;
  return { ...(active === undefined ? {} : { active }), presets: store.presets.filter((preset) => preset !== target) };
}

/** The preset after the active one, wrapping round; the first when none is active. */
export function nextPreset(store: OverlayPresetStore): OverlayPreset | undefined {
  if (store.presets.length === 0) return undefined;
  const index = store.active === undefined ? -1 : store.presets.findIndex((preset) => preset.name.toLowerCase() === store.active!.toLowerCase());
  return store.presets[(index + 1) % store.presets.length];
}

/** Keeps what is recognisably a preset. Its settings are checked when applied, against the displays there are then. */
export function normalizePresetStore(candidate: unknown): OverlayPresetStore {
  const source = isRecord(candidate) ? candidate : {};
  const presets: OverlayPreset[] = [];
  for (const entry of Array.isArray(source.presets) ? source.presets : []) {
    const name = isRecord(entry) ? normalizePresetName(entry.name) : undefined;
    if (!name || !isRecord(entry) || !isRecord(entry.settings) || !isRecord(entry.settings.elements)) continue;
    if (presets.some((preset) => preset.name.toLowerCase() === name.toLowerCase()) || presets.length >= MAX_PRESETS) continue;
    presets.push({ name, settings: entry.settings as unknown as OverlayPresetSettings });
  }
  const active = normalizePresetName(source.active);
  const activePreset = active === undefined ? undefined : presets.find((preset) => preset.name.toLowerCase() === active.toLowerCase());
  return { ...(activePreset ? { active: activePreset.name } : {}), presets };
}

/** The presets live beside the overlay settings they are snapshots of. */
export function presetStorePath(overlaySettingsPath: string): string {
  return path.join(path.dirname(overlaySettingsPath), "overlay-presets.json");
}

export function loadPresetStore(file: string): Promise<OverlayPresetStore> {
  return loadJsonSettings(file, normalizePresetStore, () => ({ presets: [] }));
}

export function savePresetStore(store: OverlayPresetStore, file: string): Promise<void> {
  return writeJsonFileAtomic(file, store);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
