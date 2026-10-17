import { useEffect, useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact } from "@svoverlay/ui-kit/format";
import { FARM_MEASURE_MS, farmPerHour } from "@svoverlay/contracts/farm";
import { chromeState, farmState } from "../store.ts";
import { desktopView } from "../transport.ts";

const TICK_MS = 1_000;

/** 125 000 ms -> "2:05". */
function minutesSeconds(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function send(request: "startFarm" | "stopFarm"): void {
  void desktopView.rpc?.request[request]({}).then((next) => { farmState.value = next; });
}

/** Experience, job experience and coins, each per hour with its total beneath. */
function Gains({ experience, jobExperience, coins, durationMs }: { experience: number; jobExperience: number; coins: number; durationMs: number }) {
  const t = useTranslator();
  const cell = (label: string, amount: number, kind: string) => (
    <div class={`farm-cell is-${kind}`}>
      <span class="farm-label">{label}<small>{t("overlay.farm.perHour")}</small></span>
      <span class="farm-rate">{formatCompact(farmPerHour(amount, durationMs))}</span>
      <span class="farm-total">{formatCompact(amount)}</span>
    </div>
  );
  return (
    <div class="farm-gains">
      {cell(t("overlay.farm.xp"), experience, "xp")}
      {cell(t("overlay.farm.job"), jobExperience, "job")}
      {cell(t("overlay.farm.gold"), coins, "gold")}
    </div>
  );
}

/**
 * Farm effectiveness: measures what the current map yields over ten minutes, once per map. Started
 * by its keybind, or by Play while the overlay is unlocked (a locked overlay lets clicks through).
 */
export function FarmElement() {
  const t = useTranslator();
  const farm = farmState.value;
  const chrome = chromeState.value;
  const locked = chrome?.locked ?? true;
  const running = farm?.running;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!running) return undefined;
    const ticker = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(ticker);
  }, [running?.startedAtMs]);

  const report = farm?.report;
  const placeName = running?.mapName ?? farm?.place?.name;
  const shortcut = chrome?.shortcuts.startFarm;
  const elapsed = running ? Math.min(FARM_MEASURE_MS, Math.max(0, now - running.startedAtMs)) : 0;

  let body;
  if (running) {
    body = (
      <>
        <div class="farm-run" style={`--progress:${(elapsed / FARM_MEASURE_MS).toFixed(4)}`}>
          <span class="farm-clock">{minutesSeconds(running.endsAtMs - now)}</span>
          <span class="farm-bar" aria-hidden="true" />
        </div>
        <Gains experience={running.experience} jobExperience={running.jobExperience} coins={running.coins} durationMs={Math.max(elapsed, 60_000)} />
      </>
    );
  } else if (report) {
    body = (
      <>
        <Gains experience={report.experience} jobExperience={report.jobExperience} coins={report.coins} durationMs={report.durationMs} />
        <p class="farm-note">{t("overlay.farm.measured", { date: new Date(report.startedAtMs).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" }), minutes: Math.round(report.durationMs / 60_000) })}</p>
      </>
    );
  } else {
    const notice = farm?.notice;
    body = (
      <p class="farm-note">
        {notice && notice !== "measured" ? t(`overlay.farm.notice.${notice}`)
          : !farm?.place ? t("overlay.farm.notice.noMap")
          : shortcut ? t("overlay.farm.hint", { shortcut }) : t("overlay.farm.hintUnlock")}
      </p>
    );
  }

  return (
    <div class={`element-content farm-content${running ? " is-running" : report ? " is-measured" : ""}`}>
      <div class="farm-head">
        <h2 class="element-title">{t("overlay.farm.title")}</h2>
        {placeName && <span class="farm-map">{placeName}</span>}
      </div>
      {body}
      {!locked && (running || (!report && farm?.place)) && (
        <button class="farm-button" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => send(running ? "stopFarm" : "startFarm")}>
          {t(running ? "overlay.farm.stop" : "overlay.farm.play")}
        </button>
      )}
    </div>
  );
}
