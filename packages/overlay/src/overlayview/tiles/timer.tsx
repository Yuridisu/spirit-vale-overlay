import { useEffect, useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatTimer, timerDisplayMs, timerFinished } from "../../timer.ts";
import { timerState } from "../store.ts";

const TICK_MS = 200;

/** A personal countdown or stopwatch, driven by its keybinds. */
export function TimerElement() {
  const t = useTranslator();
  const timer = timerState.value;
  const [now, setNow] = useState(() => Date.now());
  const running = timer?.running === true;
  useEffect(() => {
    setNow(Date.now());
    if (!running) return undefined;
    const ticker = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(ticker);
  }, [running, timer?.startedAtMs, timer?.elapsedMs]);

  if (!timer) return <div class="timer-tile"><span class="timer-value">--:--</span></div>;
  const finished = timerFinished(timer, now);
  const state = finished ? "finished" : running ? "running" : "paused";
  return (
    <div class={`timer-tile timer-${state}`}>
      <span class="timer-mode">{t(`overlay.timer.mode.${timer.mode}`)}</span>
      <span class="timer-value">{formatTimer(timerDisplayMs(timer, now))}</span>
    </div>
  );
}
