import { readFile } from "node:fs/promises";

import { SafeSaveQueue } from "@svoverlay/desktop-platform/safe-save";
import { writeJsonFileAtomic } from "@svoverlay/desktop-platform/json-settings";
import {
  FARM_MEASURE_MS,
  farmPerHour,
  type FarmNotice,
  type FarmPlace,
  type FarmReport,
  type FarmRun,
  type FarmState,
} from "@svoverlay/contracts/farm";

/** Gains logged a moment after the run's end still belong to it: the reward log trails the game. */
const LATE_GAIN_GRACE_MS = 5_000;
const TICK_MS = 1_000;
/** How often the map is looked at between runs, so the overlay names the map the player is on. */
const PLACE_POLL_MS = 2_000;

/** One reward the player received, as the reward log records it. */
export interface FarmGain {
  experience: number;
  jobExperience: number;
  coins: number;
  recordedAtMs: number;
}

export interface FarmCoordinatorOptions {
  storagePath: string;
  /** Where the player is now, once the map is known. */
  place(): FarmPlace | undefined;
  /** The character playing, for the report. */
  character(): { name?: string; level?: number } | undefined;
  /** Every reward the player receives. */
  subscribeGains(listener: (gain: FarmGain) => void): () => void;
  onWarning?: (warning: string | undefined) => void;
  now?: () => number;
}

export interface FarmCoordinator {
  getState(): FarmState;
  /** Starts measuring the map the player is on, unless it is already measured or unknown. */
  start(): FarmState;
  /** Drops the run under way without a report. */
  stop(): FarmState;
  /** Forgets one map's report, or every report, so it can be measured again. */
  reset(key?: string): FarmState;
  /** The player may be on another map: a run there is dropped, and listeners hear of the new place. */
  noteMapChange(): void;
  subscribe(listener: () => void): () => void;
  shutdown(): Promise<void>;
}

interface PersistedFarmReports {
  version: 1;
  reports: FarmReport[];
}

export async function createFarmCoordinator(options: FarmCoordinatorOptions): Promise<FarmCoordinator> {
  const now = options.now ?? Date.now;
  const reports = new Map<string, FarmReport>();
  const listeners = new Set<() => void>();
  let running: (FarmRun & { character?: string; level?: number }) | undefined;
  let notice: FarmNotice | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let lastPlaceKey: string | undefined;
  let shuttingDown = false;

  for (const report of await loadReports(options.storagePath)) reports.set(report.key, report);
  // Not every first sighting of a map is announced as a map change, so the place is also looked at here.
  const placeWatcher = setInterval(() => { if (!running) notifyIfPlaceChanged(); }, PLACE_POLL_MS);
  placeWatcher.unref?.();

  const persistence = new SafeSaveQueue<FarmReport[]>({
    label: "farm reports",
    clone: false,
    save: (value) => writeJsonFileAtomic(options.storagePath, { version: 1, reports: value } satisfies PersistedFarmReports),
    onWarning: (warning) => options.onWarning?.(warning),
  });

  const unsubscribeGains = options.subscribeGains((gain) => {
    if (!running || gain.recordedAtMs < running.startedAtMs || gain.recordedAtMs > running.endsAtMs) return;
    running.experience += Math.max(0, gain.experience);
    running.jobExperience += Math.max(0, gain.jobExperience);
    running.coins += Math.max(0, gain.coins);
    notify();
  });

  return {
    getState,
    start,
    stop,
    reset,
    noteMapChange: () => {
      if (shuttingDown) return;
      if (!checkPlace()) notifyIfPlaceChanged();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    shutdown: async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      stopTicker();
      clearInterval(placeWatcher);
      unsubscribeGains();
      await persistence.flush(snapshot());
    },
  };

  function getState(): FarmState {
    const place = options.place();
    const report = place ? reports.get(place.key) : undefined;
    return {
      ...(place ? { place } : {}),
      ...(running ? { running: publicRun(running) } : {}),
      ...(report ? { report: { ...report } } : {}),
      reports: [...reports.values()]
        .sort((left, right) => farmPerHour(right.experience, right.durationMs) - farmPerHour(left.experience, left.durationMs))
        .map((entry) => ({ ...entry })),
      ...(notice ? { notice } : {}),
    };
  }

  function start(): FarmState {
    if (shuttingDown || running) return getState();
    const place = options.place();
    if (!place) notice = "noMap";
    else if (reports.has(place.key)) notice = "measured";
    else {
      const startedAtMs = now();
      const character = options.character();
      running = {
        key: place.key,
        mapName: place.name,
        startedAtMs,
        endsAtMs: startedAtMs + FARM_MEASURE_MS,
        experience: 0,
        jobExperience: 0,
        coins: 0,
        ...(character?.name ? { character: character.name } : {}),
        ...(character?.level === undefined ? {} : { level: character.level }),
      };
      notice = undefined;
      startTicker();
    }
    notify();
    return getState();
  }

  function stop(): FarmState {
    if (running) end("stopped");
    return getState();
  }

  function reset(key?: string): FarmState {
    if (key === undefined) reports.clear();
    else reports.delete(key);
    if (notice === "measured" || notice === "done") notice = undefined;
    persistence.schedule(snapshot());
    notify();
    return getState();
  }

  /** Ends the run when its time is up or the player left its map. Returns whether it ended. */
  function checkPlace(): boolean {
    if (!running) return false;
    if (now() >= running.endsAtMs + LATE_GAIN_GRACE_MS) {
      finish();
      return true;
    }
    // A channel switch or a loading screen leaves the map unknown for a moment; only another map ends it.
    const place = options.place();
    if (place && place.key !== running.key) {
      end("leftMap");
      return true;
    }
    return false;
  }

  function finish(): void {
    if (!running) return;
    const { character, level, endsAtMs: _endsAtMs, ...run } = running;
    reports.set(run.key, {
      key: run.key,
      mapName: run.mapName,
      ...(character ? { character } : {}),
      ...(level === undefined ? {} : { level }),
      startedAtMs: run.startedAtMs,
      durationMs: FARM_MEASURE_MS,
      experience: run.experience,
      jobExperience: run.jobExperience,
      coins: run.coins,
    });
    persistence.schedule(snapshot());
    end("done");
  }

  function end(why: FarmNotice): void {
    running = undefined;
    notice = why;
    stopTicker();
    notify();
  }

  function startTicker(): void {
    stopTicker();
    ticker = setInterval(() => {
      if (!checkPlace()) notify();
    }, TICK_MS);
    ticker.unref?.();
  }

  function stopTicker(): void {
    if (ticker !== undefined) clearInterval(ticker);
    ticker = undefined;
  }

  function notifyIfPlaceChanged(): void {
    const key = options.place()?.key;
    if (key === lastPlaceKey) return;
    lastPlaceKey = key;
    // A finished or dropped run's message belongs to the map it was on.
    if (notice !== undefined && !running) notice = undefined;
    notify();
  }

  function notify(): void {
    if (shuttingDown) return;
    for (const listener of listeners) listener();
  }

  function snapshot(): FarmReport[] {
    return [...reports.values()].map((entry) => ({ ...entry }));
  }
}

function publicRun(run: FarmRun): FarmRun {
  return {
    key: run.key,
    mapName: run.mapName,
    startedAtMs: run.startedAtMs,
    endsAtMs: run.endsAtMs,
    experience: run.experience,
    jobExperience: run.jobExperience,
    coins: run.coins,
  };
}

async function loadReports(file: string): Promise<FarmReport[]> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as Partial<PersistedFarmReports>;
    if (value?.version !== 1 || !Array.isArray(value.reports)) return [];
    return value.reports.flatMap((candidate) => {
      const report = candidate as Partial<FarmReport>;
      if (typeof report?.key !== "string" || typeof report.mapName !== "string") return [];
      const numbers = [report.startedAtMs, report.durationMs, report.experience, report.jobExperience, report.coins];
      if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))) return [];
      return [{
        key: report.key,
        mapName: report.mapName,
        ...(typeof report.character === "string" ? { character: report.character } : {}),
        ...(typeof report.level === "number" ? { level: report.level } : {}),
        startedAtMs: report.startedAtMs!,
        durationMs: report.durationMs!,
        experience: report.experience!,
        jobExperience: report.jobExperience!,
        coins: report.coins!,
      }];
    });
  } catch {
    return [];
  }
}
