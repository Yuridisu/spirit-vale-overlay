import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatInteger } from "@svoverlay/ui-kit/format";
import { damageTakenState, killState, meterState } from "../store.ts";
import { WaitingForDps } from "./common.tsx";

const SKILL_ROW_COLOR = "rgba(40, 132, 210, 0.52)";
const KILL_ROW_COLOR = "rgba(190, 74, 69, 0.46)";
const TAKEN_ROW_COLOR = "rgba(213, 130, 42, 0.5)";

/** The local player's encounter damage, broken down by the skill or attack that dealt it. */
export function DpsDetailsElement() {
  const t = useTranslator();
  const skills = meterState.value?.personal?.skills ?? [];
  const top = Math.max(1, ...skills.map((skill) => skill.damage));
  return (
    <div class="element-content">
      <h2 class="element-title">{t("overlay.dpsDetails.heading")}</h2>
      {skills.length ? <div class="ranking">{skills.map((skill) => (
        <div
          class="ranking-row detail-row"
          key={skill.sourceId}
          style={`--row-fill:${skill.damage / top * 100}%;--row-color:${SKILL_ROW_COLOR}`}
          title={t("overlay.dpsDetails.tooltip", { hits: formatInteger(skill.hits), crit: Math.round((skill.critRate ?? 0) * 100) })}
        >
          <span class="ranking-name">{skill.label}</span>
          <span class="detail-values">
            <strong>{formatCompact(skill.damage)}</strong>
            <span class="detail-share">{Math.round(skill.contribution * 100)}%</span>
          </span>
        </div>
      ))}</div> : <WaitingForDps />}
    </div>
  );
}

/** The damage the local player has been taking, by the monster and the skill or attack that dealt it. */
export function DamageTakenElement() {
  const t = useTranslator();
  const taken = damageTakenState.value;
  const rows = taken?.rows ?? [];
  const total = taken?.total ?? 0;
  const top = Math.max(1, ...rows.map((row) => row.damage));
  return (
    <div class="element-content">
      <div class="party-heading">
        <h2 class="element-title">{t("overlay.damageTaken.heading")}</h2>
        {total > 0 && (
          <span class="party-reset-hint">{t("overlay.damageTaken.total", { total: formatCompact(total) })}</span>
        )}
      </div>
      {rows.length ? <div class="ranking">{rows.map((row) => (
        <div
          class="ranking-row detail-row"
          key={`${row.attacker ?? ""}/${row.label}`}
          style={`--row-fill:${row.damage / top * 100}%;--row-color:${TAKEN_ROW_COLOR}`}
        >
          <span class="kill-name">
            <span class="ranking-name">{row.label}</span>
            <span class="kill-rewards">
              {row.attacker === undefined
                ? t("overlay.damageTaken.hits", { hits: formatInteger(row.hits) })
                : t("overlay.damageTaken.source", { attacker: row.attacker, hits: formatInteger(row.hits) })}
            </span>
          </span>
          <span class="detail-values">
            <strong>{formatCompact(row.damage)}</strong>
            <span class="detail-share">{Math.round(row.damage / Math.max(1, total) * 100)}%</span>
          </span>
        </div>
      ))}</div> : <span class="detail-empty">{t("overlay.damageTaken.empty")}</span>}
    </div>
  );
}

/** Monsters the local player has killed on this map, most killed first. */
export function KillCounterElement() {
  const t = useTranslator();
  const kills = killState.value?.kills ?? [];
  const total = kills.reduce((sum, kill) => sum + kill.count, 0);
  const top = Math.max(1, ...kills.map((kill) => kill.count));
  return (
    <div class="element-content">
      <div class="party-heading">
        <h2 class="element-title">{t("overlay.killCounter.heading")}</h2>
        {kills.length > 0 && <span class="party-reset-hint">{t("overlay.killCounter.total", { total: formatInteger(total) })}</span>}
      </div>
      {kills.length ? <div class="ranking">{kills.map((kill) => (
        <div
          class="ranking-row detail-row"
          key={kill.name}
          style={`--row-fill:${kill.count / top * 100}%;--row-color:${KILL_ROW_COLOR}`}
        >
          <span class="kill-name">
            <span class="ranking-name">{kill.name}</span>
            <span class="kill-rewards">
              {t("overlay.killCounter.rewards", { experience: formatCompact(kill.experience), coins: formatCompact(kill.coins) })}
            </span>
          </span>
          <span class="detail-values"><strong>{formatInteger(kill.count)}</strong></span>
        </div>
      ))}</div> : <span class="detail-empty">{t("overlay.killCounter.empty")}</span>}
    </div>
  );
}
