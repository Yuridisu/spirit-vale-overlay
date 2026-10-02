import { expect, test } from "bun:test";

import { formatTimer, idleTimer, timerDisplayMs, timerElapsedMs, timerFinished, toggleTimer } from "./timer.ts";

const START = 1_000_000;

test("a countdown runs down, pauses, resumes, and stops at zero", () => {
  let timer = toggleTimer(idleTimer("countdown", 600_000), START);
  expect(timerDisplayMs(timer, START + 90_000)).toBe(510_000);

  timer = toggleTimer(timer, START + 90_000);
  expect(timer.running).toBe(false);
  expect(timerDisplayMs(timer, START + 500_000)).toBe(510_000);

  timer = toggleTimer(timer, START + 500_000);
  expect(timerDisplayMs(timer, START + 500_000 + 510_000)).toBe(0);
  expect(timerDisplayMs(timer, START + 9_999_999)).toBe(0);
});

test("a countdown reports finished exactly when it reaches zero", () => {
  const timer = toggleTimer(idleTimer("countdown", 10_000), START);
  expect(timerFinished(timer, START + 9_999)).toBe(false);
  expect(timerFinished(timer, START + 10_000)).toBe(true);
});

test("pressing start on a finished countdown acknowledges it and rearms the timer", () => {
  const finished = toggleTimer(idleTimer("countdown", 10_000), START);
  const rearmed = toggleTimer(finished, START + 60_000);
  expect(rearmed).toEqual(idleTimer("countdown", 10_000));
  expect(timerFinished(rearmed, START + 60_000)).toBe(false);
});

test("a stopwatch counts up without limit until it is paused", () => {
  let timer = toggleTimer(idleTimer("stopwatch", 10_000), START);
  expect(timerElapsedMs(timer, START + 5 * 3_600_000)).toBe(5 * 3_600_000);
  expect(timerFinished(timer, START + 5 * 3_600_000)).toBe(false);

  timer = toggleTimer(timer, START + 5 * 3_600_000);
  expect(timerDisplayMs(timer, START + 9 * 3_600_000)).toBe(5 * 3_600_000);
});

test("formats minutes and seconds, adding hours only when needed", () => {
  expect(formatTimer(600_000)).toBe("10:00");
  expect(formatTimer(599_001)).toBe("10:00");
  expect(formatTimer(599_000)).toBe("09:59");
  expect(formatTimer(0)).toBe("00:00");
  expect(formatTimer(3_723_000)).toBe("1:02:03");
});
