export const TIMER_MODES = ["countdown", "stopwatch"] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/**
 * The timer as the backend holds it. Time is never stored as a running total: `elapsedMs` is what
 * accumulated before the last start, and a running timer adds the time since `startedAtMs`, so the
 * renderer can tick on its own without a message per second.
 */
export interface OverlayTimerState {
  mode: TimerMode;
  /** Target of a countdown; ignored by a stopwatch. */
  durationMs: number;
  running: boolean;
  elapsedMs: number;
  startedAtMs?: number;
}

export function idleTimer(mode: TimerMode, durationMs: number): OverlayTimerState {
  return { mode, durationMs, running: false, elapsedMs: 0 };
}

export function timerElapsedMs(timer: OverlayTimerState, nowMs: number): number {
  const live = timer.running && timer.startedAtMs !== undefined ? Math.max(0, nowMs - timer.startedAtMs) : 0;
  const elapsed = timer.elapsedMs + live;
  return timer.mode === "countdown" ? Math.min(elapsed, timer.durationMs) : elapsed;
}

/** A countdown that has reached zero, which is what the tile flashes for. */
export function timerFinished(timer: OverlayTimerState, nowMs: number): boolean {
  return timer.mode === "countdown" && timerElapsedMs(timer, nowMs) >= timer.durationMs;
}

/** What the tile shows: time left on a countdown, time passed on a stopwatch. */
export function timerDisplayMs(timer: OverlayTimerState, nowMs: number): number {
  const elapsed = timerElapsedMs(timer, nowMs);
  return timer.mode === "countdown" ? timer.durationMs - elapsed : elapsed;
}

/** Start or pause; on a finished countdown the same press acknowledges it and rearms the timer. */
export function toggleTimer(timer: OverlayTimerState, nowMs: number): OverlayTimerState {
  if (timerFinished(timer, nowMs)) return idleTimer(timer.mode, timer.durationMs);
  if (timer.running) {
    return { mode: timer.mode, durationMs: timer.durationMs, running: false, elapsedMs: timerElapsedMs(timer, nowMs) };
  }
  return { ...timer, running: true, startedAtMs: nowMs };
}

export function formatTimer(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1_000 - 1e-9));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
