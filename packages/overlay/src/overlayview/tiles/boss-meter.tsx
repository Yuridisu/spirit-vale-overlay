import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDps, formatDuration, formatInteger } from "@svoverlay/ui-kit/format";
import { bossFightState } from "../store.ts";
import { overlayClassIcon } from "./common.tsx";

const BOSS_ROW_COLORS = [
  "rgba(40, 132, 210, 0.52)", "rgba(111, 91, 211, 0.52)",
  "rgba(213, 130, 42, 0.52)", "rgba(193, 71, 139, 0.52)",
  "rgba(27, 151, 135, 0.52)", "rgba(99, 153, 52, 0.52)",
  "rgba(190, 74, 69, 0.52)", "rgba(181, 151, 45, 0.52)",
] as const;

/** Who dealt what to the boss: the fight's total, its pace and length, and each player's share. */
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
  const top = Math.max(1, ...fight.rows.map((row) => row.damage));
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
      <div class="ranking">{fight.rows.map((row, index) => (
        <div
          class="ranking-row"
          key={row.name}
          style={`--row-fill:${row.damage / top * 100}%;--row-color:${BOSS_ROW_COLORS[index % BOSS_ROW_COLORS.length]}`}
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
    </div>
  );
}
