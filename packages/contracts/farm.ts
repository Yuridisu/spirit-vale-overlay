/**
 * Farm effectiveness: what one map yields in experience and coins over a fixed stretch of play.
 * The player starts a measurement on the map they are on; it runs for FARM_MEASURE_MS, and the
 * map's report is kept until it is reset, so a map is measured once.
 */

/** How long one measurement lasts. */
export const FARM_MEASURE_MS = 10 * 60_000;

/** A place the game names: a map, or the Eternal Tower (floor). */
export interface FarmPlace {
  /** "map:12", "tower:3": the report key. */
  key: string;
  name: string;
}

/** One map's measurement, as kept. */
export interface FarmReport {
  key: string;
  mapName: string;
  /** The character that farmed it, and its level when the measurement started. */
  character?: string;
  level?: number;
  startedAtMs: number;
  durationMs: number;
  experience: number;
  jobExperience: number;
  coins: number;
}

/** A measurement under way. */
export interface FarmRun {
  key: string;
  mapName: string;
  startedAtMs: number;
  endsAtMs: number;
  experience: number;
  jobExperience: number;
  coins: number;
}

/**
 * Why the last start did nothing or how the last run ended: no map known yet, the map was
 * already measured, the player left the map (the run is dropped), stopped it, or it finished.
 */
export type FarmNotice = "noMap" | "measured" | "leftMap" | "stopped" | "done";

export interface FarmState {
  /** Where the player is, once the map is known. */
  place?: FarmPlace;
  running?: FarmRun;
  /** The report of the place the player is on, when it has been measured. */
  report?: FarmReport;
  /** Every report, best experience per hour first. */
  reports: FarmReport[];
  notice?: FarmNotice;
}

/** An amount gained over a duration, per hour. */
export function farmPerHour(amount: number, durationMs: number): number {
  return durationMs > 0 ? (amount * 3_600_000) / durationMs : 0;
}
