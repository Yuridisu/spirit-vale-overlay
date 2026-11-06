import { useEffect, useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatBossClock, formatBossCountdown } from "@svoverlay/contracts/boss-timers";
import { DARK_FORTRESS_RESPAWN_MS, type DarkFortressBoss } from "@svoverlay/contracts/dark-fortress";
import { darkFortressState } from "../store.ts";

/**
 * DF Boss Fight: the eight Echo Masters on the channel the player is on, each alive with its
 * health draining, or counting down to its respawn. Another channel starts it over.
 */
export function DfBossFightElement() {
  const t = useTranslator();
  const state = darkFortressState.value;
  // Re-renders every second while a respawn counts down.
  const [, setTick] = useState(0);
  const counting = state?.bosses.some((boss) => boss.status === "dead") ?? false;
  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1_000);
    return () => clearInterval(timer);
  }, [counting]);
  return (
    <div class="boss-timers df-bosses">
      <div class="df-head">
        <h2 class="element-title">{t("overlay.df.title")}</h2>
        <span class="df-channel">{state?.channel === undefined ? t("overlay.df.waiting") : t("overlay.df.channel", { channel: state.channel })}</span>
      </div>
      {(state?.bosses ?? []).map((boss) => <DfBossRow key={boss.mobId} boss={boss} nowMs={Date.now()} />)}
    </div>
  );
}

function DfBossRow({ boss, nowMs }: { boss: DarkFortressBoss; nowMs: number }) {
  const t = useTranslator();
  if (boss.status === "dead" && boss.diedAtMs !== undefined) {
    const backAtMs = boss.diedAtMs + DARK_FORTRESS_RESPAWN_MS;
    const left = backAtMs - nowMs;
    const description = t("overlay.df.tooltip.dead", {
      time: formatBossClock(boss.diedAtMs),
      killer: boss.killedBy ? ` (${boss.killedBy})` : "",
      back: formatBossClock(backAtMs),
    });
    return (
      <div class={`boss-timer-row ${left > 0 ? "boss-waiting" : "boss-window"}`} style={`--time-left:${Math.max(0, Math.min(1, left / DARK_FORTRESS_RESPAWN_MS))}`} title={t("overlay.df.tooltip", { boss: boss.name, description })}>
        <span class="boss-timer-name"><span class="boss-timer-name-text">{boss.name}</span></span>
        <span class="boss-timer-status">{left > 0 ? t("overlay.df.respawn", { time: formatBossCountdown(left) }) : t("overlay.df.due")}</span>
      </div>
    );
  }
  // Every boss is taken to be alive until its gravestone or its death says otherwise, at full
  // health until the game sends its health.
  const share = boss.health && boss.health.max > 0 ? Math.max(0, Math.min(1, boss.health.current / boss.health.max)) : 1;
  return (
    <div class="boss-timer-row df-alive" style={`--time-left:${share}`} title={t("overlay.df.tooltip", { boss: boss.name, description: t("overlay.df.tooltip.alive") })}>
      <span class="boss-timer-name"><span class="boss-timer-name-text">{boss.name}</span></span>
      <span class="boss-timer-status">{`${Math.max(0, Math.ceil(share * 100))}%`}</span>
    </div>
  );
}
