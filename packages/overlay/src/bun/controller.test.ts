import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { CharacterViewState } from "@kar-mi/spirit-vale-tools-character";

import type { BossTimerState, OverlayControlState } from "../app-types.ts";
import { defaultOverlaySettings, type OverlaySettings } from "../settings.ts";
import { createOverlayController, type OverlayController, type OverlaySurfaceSink } from "./controller.ts";

const emptyCharacter: CharacterViewState = { stats: [], gearTotals: [], status: "waiting", statusDetail: "" };
const emptyRate = { total: 0, perSecond: 0, perHour: 0 };

let temporaryRoots: string[] = [];
let controllers: OverlayController[] = [];

afterEach(async () => {
  await Promise.all(controllers.map((controller) => controller.shutdown()));
  controllers = [];
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
  temporaryRoots = [];
});

/** Records what the controller pushes, so a test can read the last control state a surface saw. */
function recordingSurface(display: string): OverlaySurfaceSink & { control?: OverlayControlState } {
  return {
    display,
    setClickThrough: () => {},
    setVisible: () => {},
    sendControl(state) { this.control = state; },
    sendCharacter: () => {},
    sendStatuses: () => {},
    sendMeter: () => {},
    sendBossTimers: () => {},
    sendDragPreview: () => {},
    sendMinimap: () => {},
    sendLootToast: () => {},
    sendGearPickup: () => {},
    sendArtifactPickup: () => {},
    sendTimer: () => {},
    sendKills: () => {},
    sendBossFight: () => {},
    sendGearRating: () => {},
    sendDamageTaken: () => {},
    sendItemCounter: () => {},
    sendTargetDrop: () => {},
  };
}

async function createController(settingsPath: string): Promise<OverlayController> {
  const controller = await createOverlayController({
    logDirectory: path.dirname(settingsPath),
    settingsPath,
    getCharacterState: () => emptyCharacter,
    subscribeCharacter: () => () => {},
    subscribeActiveStatuses: () => () => {},
    subscribeMinimap: () => () => {},
    subscribeLootToast: () => () => {},
    subscribeGearPickup: () => () => {},
    subscribeArtifactPickup: () => () => {},
    subscribeKills: () => () => {},
    subscribeBossFight: () => () => {},
    subscribeGearRating: () => () => {},
    subscribeDamageTaken: () => () => {},
    subscribeInventory: () => () => {},
    subscribeStackPickup: () => () => {},
    xp: {
      getSnapshot: () => ({ ...emptyRate, timeline: [] }),
      getCoinsSnapshot: () => ({ ...emptyRate }),
      reset: () => {},
      resetCoins: () => {},
      subscribe: () => () => {},
    },
    bossTimers: {
      getState: (): BossTimerState => ({ timers: [] }),
      subscribe: () => () => {},
    },
  });
  controllers.push(controller);
  return controller;
}

async function settingsFile(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "overlay-controller-"));
  temporaryRoots.push(root);
  return path.join(root, "overlay.json");
}

/** The controller's own display list, so imported element displays resolve instead of being re-homed. */
function importedSettings(controller: OverlayController, changes: Partial<OverlaySettings>): OverlaySettings {
  return { ...defaultOverlaySettings(controller.displays), ...changes };
}

describe("replaceSettings", () => {
  test("publishes the imported elements to every surface", async () => {
    const controller = await createController(await settingsFile());
    const surface = recordingSurface(controller.wantedSurfaces()[0]!);
    controller.registerSurface(surface);
    const defaults = defaultOverlaySettings(controller.displays);

    controller.replaceSettings(importedSettings(controller, {
      elements: {
        ...defaults.elements,
        partyRanking: { ...defaults.elements.partyRanking, x: 640, y: 480 },
      },
      minimapRarityFilter: 4,
    }));

    expect(surface.control?.elements.partyRanking?.x).toBe(640);
    expect(surface.control?.elements.partyRanking?.y).toBe(480);
  });

  test("keeps the current lock mode rather than adopting the imported one", async () => {
    const controller = await createController(await settingsFile());
    controller.updateLocked(true);

    controller.replaceSettings(importedSettings(controller, { locked: false }));

    expect(controller.locked).toBe(true);
  });

  test("persists the normalized result so the file matches what is now in memory", async () => {
    const file = await settingsFile();
    const controller = await createController(file);

    controller.replaceSettings(importedSettings(controller, { meterStatType: "heal", minimapEnabled: false }));
    await controller.shutdown();

    const saved = JSON.parse(await readFile(file, "utf8")) as OverlaySettings;
    expect(saved.meterStatType).toBe("heal");
    expect(saved.minimapEnabled).toBe(false);
  });
});

describe("presets", () => {
  test("saves the layout, applies it back over later changes, and reports both to the surface", async () => {
    const controller = await createController(await settingsFile());
    const surface = recordingSurface(controller.wantedSurfaces()[0]!);
    controller.registerSurface(surface);

    controller.setElementPosition("clock", 100, 200);
    controller.setElementEnabled("clock", true);
    controller.setMinimapRange(300);
    expect(controller.savePreset("Farming")).toBe(true);

    controller.setElementPosition("clock", 700, 50);
    controller.setElementEnabled("clock", false);
    controller.setMinimapRange(120);
    expect(controller.savePreset("Boss")).toBe(true);
    expect(controller.settingsState()).toMatchObject({ presets: ["Farming", "Boss"], activePreset: "Boss" });

    expect(controller.applyPreset("farming")).toBe(true);
    const state = controller.settingsState();
    expect(state.activePreset).toBe("Farming");
    expect(state.elements.clock).toMatchObject({ enabled: true, x: 100, y: 200 });
    expect(state.minimapRange).toBe(300);
    expect(surface.control?.elements.clock).toMatchObject({ enabled: true, x: 100, y: 200 });
    expect(controller.applyPreset("Nowhere")).toBe(false);
  });

  test("applying a preset leaves the lock and the hotkeys as they are", async () => {
    const controller = await createController(await settingsFile());
    controller.updateLocked(false);
    controller.savePreset("Unlocked when saved");
    controller.updateLocked(true);
    controller.setShortcut("toggleLock", "Ctrl+Shift+L");

    controller.applyPreset("Unlocked when saved");

    expect(controller.locked).toBe(true);
    expect(controller.settingsState().shortcuts.toggleLock).toBe("Ctrl+Shift+L");
  });

  test("steps through the presets in order and wraps round", async () => {
    const controller = await createController(await settingsFile());
    expect(controller.cyclePreset()).toBeUndefined();
    for (const [name, range] of [["A", 150], ["B", 200], ["C", 250]] as const) {
      controller.setMinimapRange(range);
      controller.savePreset(name);
    }

    expect(controller.cyclePreset()).toBe("A");
    expect(controller.settingsState().minimapRange).toBe(150);
    expect(controller.cyclePreset()).toBe("B");
    expect(controller.cyclePreset()).toBe("C");
    expect(controller.settingsState().minimapRange).toBe(250);
    expect(controller.cyclePreset()).toBe("A");
  });

  test("overwrites, deletes, and keeps the presets across a restart", async () => {
    const file = await settingsFile();
    const controller = await createController(file);
    controller.setMinimapRange(150);
    controller.savePreset("Keep");
    controller.savePreset("Drop");
    controller.setMinimapRange(260);
    controller.savePreset("keep");
    expect(controller.deletePreset("Drop")).toBe(true);
    expect(controller.deletePreset("Drop")).toBe(false);
    await controller.shutdown();

    const restarted = await createController(file);
    expect(restarted.settingsState()).toMatchObject({ presets: ["Keep"], activePreset: "Keep" });
    restarted.setMinimapRange(100);
    expect(restarted.applyPreset("Keep")).toBe(true);
    expect(restarted.settingsState().minimapRange).toBe(260);
  });
});
