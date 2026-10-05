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
      </div>
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
                <BossMeterRows rows={boss.rows.slice(0, ROWS_PER_BOSS)} seconds={bossSeconds} colorOf={colorOf} />
              </section>
            );
          })
        : <BossMeterRows rows={fight.rows} seconds={seconds} colorOf={colorOf} />}
    </div>
  );
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
