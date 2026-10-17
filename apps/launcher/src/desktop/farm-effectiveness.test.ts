import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { FARM_MEASURE_MS, type FarmPlace } from "@svoverlay/contracts/farm";

import { createFarmCoordinator, type FarmGain } from "./farm-effectiveness.ts";

async function withFarm(run: (farm: {
  coordinator: Awaited<ReturnType<typeof createFarmCoordinator>>;
  gain: (gain: Partial<FarmGain>) => void;
  setPlace: (place: FarmPlace | undefined) => void;
  setNow: (ms: number) => void;
  storagePath: string;
}) => Promise<void>, storagePath?: string): Promise<void> {
  const directory = storagePath ? undefined : await mkdtemp(path.join(tmpdir(), "spiritvale-farm-"));
  const file = storagePath ?? path.join(directory!, "farm-reports.json");
  let place: FarmPlace | undefined = { key: "map:12", name: "Spider Forest" };
  let nowMs = 1_000_000;
  const listeners = new Set<(gain: FarmGain) => void>();
  const coordinator = await createFarmCoordinator({
    storagePath: file,
    place: () => place,
    character: () => ({ name: "Fictional Mage", level: 120 }),
    subscribeGains: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    now: () => nowMs,
  });
  try {
    await run({
      coordinator,
      gain: (gain) => { for (const listener of listeners) listener({ experience: 0, jobExperience: 0, coins: 0, recordedAtMs: nowMs, ...gain }); },
      setPlace: (next) => { place = next; coordinator.noteMapChange(); },
      setNow: (ms) => { nowMs = ms; },
      storagePath: file,
    });
  } finally {
    await coordinator.shutdown();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

describe("farm effectiveness", () => {
  test("measures the map for ten minutes and keeps its report", async () => {
    await withFarm(async ({ coordinator, gain, setNow, storagePath }) => {
      const started = coordinator.start();
      expect(started.running).toMatchObject({ key: "map:12", mapName: "Spider Forest", endsAtMs: 1_000_000 + FARM_MEASURE_MS });
      gain({ experience: 500, jobExperience: 100, coins: 40 });
      gain({ experience: 700, coins: 60, recordedAtMs: 1_000_000 + FARM_MEASURE_MS - 1 });
      // Logged before the start, or after the end: not this run's.
      gain({ experience: 9_999, recordedAtMs: 999_999 });
      gain({ experience: 9_999, recordedAtMs: 1_000_000 + FARM_MEASURE_MS + 1 });
      expect(coordinator.getState().running).toMatchObject({ experience: 1_200, jobExperience: 100, coins: 100 });
      setNow(1_000_000 + FARM_MEASURE_MS + 10_000);
      coordinator.noteMapChange();
      const state = coordinator.getState();
      expect(state.running).toBeUndefined();
      expect(state.notice).toBe("done");
      expect(state.report).toMatchObject({ key: "map:12", experience: 1_200, jobExperience: 100, coins: 100, durationMs: FARM_MEASURE_MS, character: "Fictional Mage", level: 120 });
      await coordinator.shutdown();
      const saved = JSON.parse(await readFile(storagePath, "utf8")) as { reports: unknown[] };
      expect(saved.reports).toHaveLength(1);
    });
  });

  test("a measured map is not measured again until its report is reset", async () => {
    await withFarm(async ({ coordinator, setNow }) => {
      coordinator.start();
      setNow(1_000_000 + FARM_MEASURE_MS + 10_000);
      coordinator.noteMapChange();
      const again = coordinator.start();
      expect(again.running).toBeUndefined();
      expect(again.notice).toBe("measured");
      coordinator.reset("map:12");
      expect(coordinator.getState().report).toBeUndefined();
      expect(coordinator.start().running).toMatchObject({ key: "map:12" });
    });
  });

  test("leaving the map drops the run; a moment with no map known does not", async () => {
    await withFarm(async ({ coordinator, gain, setPlace }) => {
      coordinator.start();
      gain({ experience: 300 });
      setPlace(undefined);
      expect(coordinator.getState().running).toMatchObject({ experience: 300 });
      setPlace({ key: "map:12", name: "Spider Forest" });
      setPlace({ key: "map:13", name: "Ant Hill" });
      const state = coordinator.getState();
      expect(state.running).toBeUndefined();
      expect(state.notice).toBe("leftMap");
      expect(state.reports).toHaveLength(0);
    });
  });

  test("no map known yet: nothing starts", async () => {
    await withFarm(async ({ coordinator, setPlace }) => {
      setPlace(undefined);
      const state = coordinator.start();
      expect(state.running).toBeUndefined();
      expect(state.notice).toBe("noMap");
    });
  });

  test("reports survive a restart, best experience per hour first", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "spiritvale-farm-restart-"));
    const storagePath = path.join(directory, "farm-reports.json");
    try {
      await withFarm(async ({ coordinator, gain, setNow, setPlace }) => {
        coordinator.start();
        gain({ experience: 100 });
        setNow(1_000_000 + FARM_MEASURE_MS + 10_000);
        coordinator.noteMapChange();
        setPlace({ key: "map:13", name: "Ant Hill" });
        coordinator.start();
        gain({ experience: 900, recordedAtMs: 1_000_000 + FARM_MEASURE_MS + 10_000 });
        setNow(1_000_000 + 2 * FARM_MEASURE_MS + 30_000);
        coordinator.noteMapChange();
      }, storagePath);
      await withFarm(async ({ coordinator }) => {
        expect(coordinator.getState().reports.map((report) => [report.mapName, report.experience])).toEqual([["Ant Hill", 900], ["Spider Forest", 100]]);
        coordinator.reset();
        expect(coordinator.getState().reports).toHaveLength(0);
      }, storagePath);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
