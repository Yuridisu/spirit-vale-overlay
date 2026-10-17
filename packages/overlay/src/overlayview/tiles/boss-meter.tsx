import { useEffect, useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDps, formatDuration, formatInteger } from "@svoverlay/ui-kit/format";
import type { OverlayBossFightState } from "../../app-types.ts";
import { bossFightState } from "../store.ts";
import { overlayClassIcon, teamColor } from "./common.tsx";


/** With several bosses, each one's block lists this many players at most, so all of them fit. */
const ROWS_PER_BOSS = 6;

type BossMeterRow = OverlayBossFightState["rows"][number];

/** Who dealt what to the boss: the fight's total, its pace and length, and each player's share; one block per boss when there are several. */
export function BossMeterElement() {
  const t = useTranslator();
  const fight = bossFightState.value;
  if (!fight) {
    return (
      <div class="element-content">
        <h2 class="element-title">{t("overlay.bossMeter.heading")}</h2>
        <span class="detail-empty">{t("overlay.bossMeter.empty")}</span>
      </div>
    );
  }
  // A fight of one hit has no length yet; a second is the least it can be divided by.
  const seconds = Math.max(1, fight.durationMs / 1_000);
  // A player keeps one colour in every block and in the party table.
  const colorOf = teamColor;
  return (
    <div class="element-content">
      <div class="boss-meter-heading">
        <span class={`boss-meter-tag${fight.active ? " is-active" : ""}`}>{t("overlay.bossMeter.tag")}</span>
        <span class="boss-meter-name">{fight.bossNames.join(", ")}</span>
      </div>
      <div class="boss-meter-summary">
        <strong class="boss-meter-total">{formatInteger(Math.round(fight.totalDamage))}</strong>
        <span>{t("overlay.bossMeter.rate", { dps: formatDps(fight.totalDamage / seconds) })}</span>
        <span>{t("overlay.bossMeter.time", { time: formatDuration(fight.durationMs) })}</span>
        {fight.closesInMs !== undefined && <ClosingIn closesInMs={fight.closesInMs} />}
      </div>
      {fight.health && !(fight.bosses && fight.bosses.length > 1) && <BossHealthBar health={fight.health} />}
      {fight.bosses && fight.bosses.length > 1
        ? fight.bosses.map((boss) => {
            const bossSeconds = Math.max(1, boss.durationMs / 1_000);
            return (
              <section class={`boss-meter-boss${boss.alive ? "" : " is-dead"}`} key={boss.name}>
                <div class="boss-meter-boss-heading">
                  <span class="boss-meter-boss-name">{boss.name}</span>
                  <span class="detail-values">
                    <strong>{formatCompact(boss.totalDamage)}</strong>
                    <span class="boss-meter-row-rate">{t("overlay.bossMeter.rate", { dps: formatDps(boss.totalDamage / bossSeconds) })}</span>
                  </span>
                </div>
                {boss.health && <BossHealthBar health={boss.health} />}
                <BossMeterRows rows={boss.rows.slice(0, ROWS_PER_BOSS)} seconds={bossSeconds} colorOf={colorOf} />
              </section>
            );
          })
        : <BossMeterRows rows={fight.rows} seconds={seconds} colorOf={colorOf} />}
    </div>
  );
}

/** The boss's health as the game sends it, draining as the party hits it; full until it is sent. */
export function BossHealthBar({ health }: { health?: { current: number; max: number } }) {
  const t = useTranslator();
  const share = !health ? 1 : health.max > 0 ? Math.max(0, Math.min(1, health.current / health.max)) : 0;
  return (
    <div class="boss-meter-hp" style={`--hp:${share}`} role="meter" aria-valuemin={0} aria-valuemax={health?.max ?? 1} aria-valuenow={health?.current ?? 1}>
      <div class="boss-meter-hp-fill" />
      <div class="boss-meter-hp-text">
        <span>{t("overlay.bossMeter.hp", { percent: (share * 100).toFixed(share < 0.1 ? 1 : 0) })}</span>
        {health && <span>{formatCompact(health.current)} / {formatCompact(health.max)}</span>}
      </div>
    </div>
  );
}

/** Counts down, second by second, the time a finished fight has left on the overlay. */
function ClosingIn({ closesInMs }: { closesInMs: number }) {
  const t = useTranslator();
  const [closesAtMs, setClosesAtMs] = useState(() => Date.now() + closesInMs);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setClosesAtMs(Date.now() + closesInMs);
    setNow(Date.now());
  }, [closesInMs]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((closesAtMs - now) / 1_000));
  return <span class="boss-meter-closing">{t("overlay.bossMeter.closing", { seconds })}</span>;
}

function BossMeterRows({ rows, seconds, colorOf }: { rows: readonly BossMeterRow[]; seconds: number; colorOf: (name: string) => string }) {
  const t = useTranslator();
  const top = Math.max(1, ...rows.map((row) => row.damage));
  return (
    <div class="ranking">{rows.map((row, index) => (
      <div
        class="ranking-row"
        key={row.name}
        style={`--row-fill:${row.damage / top * 100}%;--row-color:${colorOf(row.name)}`}
      >
        <span class="ranking-player">
          <img class="ranking-class-icon" src={overlayClassIcon(row.archetype)} alt="" aria-hidden="true" />
          <span class="ranking-rank">{index + 1}.</span>
          <span class="ranking-name">{row.name}</span>
        </span>
        <span class="detail-values">
          <strong>{formatCompact(row.damage)}</strong>
          <span class="boss-meter-row-rate">{t("overlay.bossMeter.rate", { dps: formatDps(row.damage / seconds) })}</span>
        </span>
      </div>
    ))}</div>
  );
}
