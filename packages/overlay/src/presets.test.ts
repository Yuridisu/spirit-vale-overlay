import { expect, test } from "bun:test";

import {
  deletePreset,
  findPreset,
  MAX_PRESETS,
  nextPreset,
  normalizePresetName,
  normalizePresetStore,
  presetSettings,
  savePreset,
  type OverlayPresetSettings,
  type OverlayPresetStore,
} from "./presets.ts";
import { defaultOverlaySettings } from "./settings.ts";

const displays = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1, isPrimary: true }];
const layout = (): OverlayPresetSettings => presetSettings(defaultOverlaySettings(displays as never));
const empty: OverlayPresetStore = { presets: [] };

test("a preset keeps the layout and what the overlay follows, not the lock or the hotkeys", () => {
  const settings = layout() as Record<string, unknown>;
  expect(Object.keys(settings)).toContain("elements");
  expect(Object.keys(settings)).toContain("targetDrops");
  expect(settings.locked).toBeUndefined();
  expect(settings.shortcuts).toBeUndefined();
  expect(settings.homeDisplay).toBeUndefined();
});

test("a preset is a copy, untouched by later changes to the settings it came from", () => {
  const settings = defaultOverlaySettings(displays as never);
  const preset = presetSettings(settings);
  settings.elements.clock.x = 999;
  expect(preset.elements.clock.x).not.toBe(999);
});

test("saving adds a preset, makes it active, and overwrites one of the same name in place", () => {
  const first = savePreset(empty, "  Farming  ", layout())!;
  const second = savePreset(first, "Boss", layout())!;
  expect(second.presets.map((preset) => preset.name)).toEqual(["Farming", "Boss"]);
  expect(second.active).toBe("Boss");

  const changed = layout();
  changed.minimapRange = 123;
  const overwritten = savePreset(second, "farming", changed)!;
  expect(overwritten.presets.map((preset) => preset.name)).toEqual(["Farming", "Boss"]);
  expect(findPreset(overwritten, "FARMING")?.settings.minimapRange).toBe(123);
  expect(overwritten.active).toBe("Farming");
});

test("refuses an empty name, and a new preset once the limit is reached", () => {
  expect(savePreset(empty, "   ", layout())).toBeUndefined();
  expect(normalizePresetName(7)).toBeUndefined();

  let store = empty;
  for (let index = 0; index < MAX_PRESETS; index += 1) store = savePreset(store, `Preset ${index}`, layout())!;
  expect(savePreset(store, "One too many", layout())).toBeUndefined();
  expect(savePreset(store, "preset 3", layout())?.presets).toHaveLength(MAX_PRESETS);
});

test("cycles to the preset after the active one, wrapping round", () => {
  let store = savePreset(savePreset(savePreset(empty, "A", layout())!, "B", layout())!, "C", layout())!;
  expect(nextPreset(empty)).toBeUndefined();
  expect(nextPreset(store)?.name).toBe("A");
  store = { ...store, active: "A" };
  expect(nextPreset(store)?.name).toBe("B");
  expect(nextPreset({ presets: store.presets })?.name).toBe("A");
});

test("deleting the active preset leaves none active", () => {
  const store = savePreset(savePreset(empty, "A", layout())!, "B", layout())!;
  expect(deletePreset(store, "b")).toEqual({ presets: [store.presets[0]!] });
  expect(deletePreset(store, "a").active).toBe("B");
  expect(deletePreset(store, "missing")).toBe(store);
});

test("reads a stored file leniently, dropping what is not a preset", () => {
  const store = normalizePresetStore({
    active: "boss",
    presets: [
      { name: "Farming", settings: layout() },
      { name: "farming", settings: layout() },
      { name: "", settings: layout() },
      { name: "No layout", settings: { minimapRange: 5 } },
      "junk",
      { name: "Boss", settings: layout() },
    ],
  });
  expect(store.presets.map((preset) => preset.name)).toEqual(["Farming", "Boss"]);
  expect(store.active).toBe("Boss");
  expect(normalizePresetStore("nonsense")).toEqual({ presets: [] });
  expect(normalizePresetStore({ active: "Gone", presets: [] })).toEqual({ presets: [] });
});
