import { useEffect, useState } from "preact/hooks";
import type { BossFightPlayer, BossFightReport } from "@svoverlay/contracts/boss-fight";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDps, formatDuration, formatInteger, formatPercent } from "@svoverlay/ui-kit/format";
import { CombatClassCell } from "../combat-class.tsx";
import { teamColor } from "@svoverlay/ui-kit/team-color";

const startedFormat = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** A fight of one hit has no length yet; a second is the least a rate can be divided by. */
const fightSeconds = (fight: BossFightReport): number => Math.max(1, fight.durationMs / 1_000);

/** Boss fights on record: the party's totals, each player's share and skills, deaths, and the boss's drops. */
export function BossFightPanel({ fights, onClear }: { fights: readonly BossFightReport[]; onClear: () => void }) {
  const t = useTranslator();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | undefined>(undefined);
  // Which boss of a fight with several the tables are showing; none shows them all together.
  const [bossView, setBossView] = useState<string | undefined>(undefined);
  // Clearing cannot be undone, so the button asks for a second click instead of acting on the first.
  const [confirmingClear, setConfirmingClear] = useState(false);
  useEffect(() => {
    if (!confirmingClear) return undefined;
    const timer = setTimeout(() => setConfirmingClear(false), 4_000);
    return () => clearTimeout(timer);
  }, [confirmingClear]);
  const whole = fights.find((candidate) => candidate.id === selectedId) ?? fights[0];

  if (!whole) return <section class="boss-screen"><div class="empty-state">{t("combat.boss.empty")}</div></section>;

  const viewedBoss = whole.bosses?.find((boss) => boss.name === bossView);
  // One boss's share reads like a fight of its own: its time, its damage and who dealt it.
  const fight: BossFightReport = viewedBoss
    ? { ...whole, durationMs: viewedBoss.durationMs, totalDamage: viewedBoss.totalDamage, defeated: viewedBoss.defeated, players: viewedBoss.players }
    : whole;

  const seconds = fightSeconds(fight);
  const deaths = fight.players.reduce((total, player) => total + player.deaths, 0);
  const status = fight.active ? t("combat.boss.status.active") : fight.defeated ? t("combat.boss.status.defeated") : t("combat.boss.status.ended");

  return (
    <section class="boss-screen">
      <div class="boss-fight-layout">
        <nav class="boss-fight-list" aria-label={t("combat.boss.list.label")}>
          <button
            type="button"
            class={`btn boss-fight-clear${confirmingClear ? " is-confirming" : ""}`}
            onClick={() => {
              if (!confirmingClear) { setConfirmingClear(true); return; }
              setConfirmingClear(false);
              setSelectedId(undefined);
              setExpanded(undefined);
              setBossView(undefined);
              onClear();
            }}
          >
            {confirmingClear ? t("combat.boss.clear.confirm") : t("combat.boss.clear", { count: fights.length })}
          </button>
          {fights.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              class={`boss-fight-item${candidate.id === fight.id ? " active" : ""}`}
              aria-pressed={candidate.id === fight.id}
              onClick={() => { setSelectedId(candidate.id); setExpanded(undefined); setBossView(undefined); }}
            >
              <strong>{candidate.bossNames.join(", ")}</strong>
              {candidate.mapName !== undefined && <span>{candidate.mapName}</span>}
              <span>
                {startedFormat.format(candidate.startedAtMs)} · {formatDuration(candidate.durationMs)} · {formatCompact(candidate.totalDamage)}
              </span>
            </button>
          ))}
        </nav>

        <div class="boss-fight-detail">
          <h2 class="boss-fight-title">
            {fight.bossNames.join(", ")}
            {fight.mapName !== undefined && <span class="boss-fight-map">{fight.mapName}</span>}
          </h2>
          {whole.bosses && whole.bosses.length > 1 && (
            <div class="boss-fight-bosses" role="group" aria-label={t("combat.boss.view.label")}>
              {[undefined, ...whole.bosses.map((boss) => boss.name)].map((name) => (
                <button
                  key={name ?? ""}
                  type="button"
                  class={`btn${bossView === name ? " active" : ""}`}
                  aria-pressed={bossView === name}
                  onClick={() => { setBossView(name); setExpanded(undefined); }}
                >
                  {name ?? t("combat.boss.view.all")}
                </button>
              ))}
            </div>
          )}
          <div class="table-scroll summary-table-scroll">
            <table class="data-table summary-table" aria-label={t("combat.boss.summary.label")}>
              <thead><tr>
                <th>{t("combat.boss.column.status")}</th>
                <th>{t("combat.totals.timer")}</th>
                <th>{t("combat.boss.column.partyDps")}</th>
                <th>{t("combat.boss.column.totalDamage")}</th>
                <th>{t("combat.boss.column.players")}</th>
                <th>{t("combat.boss.column.deaths")}</th>
              </tr></thead>
              <tbody><tr>
                <td>{status}</td>
                <td>{formatDuration(fight.durationMs)}</td>
                <td>{formatDps(fight.totalDamage / seconds)}</td>
                <td>{formatInteger(Math.round(fight.totalDamage))}</td>
                <td>{formatInteger(fight.players.filter((player) => player.damage > 0).length)}</td>
                <td>{formatInteger(deaths)}</td>
              </tr></tbody>
            </table>
          </div>

          <div class="table-scroll meter-table-scroll">
            <table class="data-table meter-table" aria-label={t("combat.boss.players.label")}>
              <thead><tr>
                <th>#</th>
                <th>{t("combat.column.class")}</th>
                <th>{t("combat.column.ign")}</th>
                <th>DPS</th>
                <th>{t("combat.boss.column.damage")}</th>
                <th>{t("combat.boss.column.share")}</th>
                <th>{t("combat.column.hits")}</th>
                <th>{t("combat.column.critRate")}</th>
                <th>{t("combat.boss.column.deaths")}</th>
              </tr></thead>
              <tbody>{fight.players.map((player, index) => (
                <PlayerRows
                  key={player.name}
                  rank={index + 1}
                  player={player}
                  fight={fight}
                  expanded={expanded === player.name}
                  onToggle={() => setExpanded(expanded === player.name ? undefined : player.name)}
                />
              ))}</tbody>
            </table>
          </div>
          <p class="boss-fight-hint">{t("combat.boss.players.hint")}</p>

          <h2 class="element-title">{t("combat.boss.drops.heading")}</h2>
          {fight.drops.length === 0
            ? <div class="empty-state">{fight.defeated ? t("combat.boss.drops.none") : t("combat.boss.drops.pending")}</div>
            : <ul class="boss-drop-list">{fight.drops.map((drop) => (
                <li key={`${drop.name}/${drop.rarity ?? ""}`} class={`boss-drop rarity-${drop.rarity ?? 0}`}>
                  <span>{drop.name}</span>
                  {drop.count > 1 && <strong>×{drop.count}</strong>}
                </li>
              ))}</ul>}
        </div>
      </div>
    </section>
  );
}

function PlayerRows(
  { rank, player, fight, expanded, onToggle }: {
    rank: number;
    player: BossFightPlayer;
    fight: BossFightReport;
    expanded: boolean;
    onToggle: () => void;
  },
) {
  const t = useTranslator();
  const share = fight.totalDamage > 0 ? player.damage / fight.totalDamage : 0;
  const seconds = fightSeconds(fight);
  return (
    <>
      <tr
        class={`meter-table-row live-player-row${expanded ? " is-expanded" : ""}`}
        style={`--row-fill:${Math.max(0, Math.min(100, share * 100))}%;--row-color:${teamColor(player.name)}`}
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(); } }}
      >
        <td>{rank}</td>
        <CombatClassCell archetype={player.archetype} />
        <th scope="row">{player.name}</th>
        <td>{formatDps(player.damage / seconds)}</td>
        <td>{formatCompact(player.damage)}</td>
        <td>{formatPercent(share)}</td>
        <td>{formatInteger(player.hits)}</td>
        <td>{player.hits > 0 ? formatPercent(player.crits / player.hits) : "—"}</td>
        <td>{formatInteger(player.deaths)}</td>
      </tr>
      {expanded && (
        <tr class="boss-skill-row">
          <td colSpan={9}>
            {player.skills.length === 0
              ? <span class="boss-fight-hint">{t("combat.boss.skills.empty")}</span>
              : <table class="data-table boss-skill-table" aria-label={t("combat.boss.skills.label", { name: player.name })}>
                  <thead><tr>
                    <th>{t("combat.column.skill")}</th>
                    <th>{t("combat.boss.column.damage")}</th>
                    <th>{t("combat.boss.column.playerShare")}</th>
                    <th>DPS</th>
                    <th>{t("combat.column.hits")}</th>
                    <th>{t("combat.column.critRate")}</th>
                  </tr></thead>
                  <tbody>{player.skills.map((skill) => (
                    <tr key={skill.label}>
                      <th scope="row">{skill.label}</th>
                      <td>{formatCompact(skill.damage)}</td>
                      <td>{formatPercent(player.damage > 0 ? skill.damage / player.damage : 0)}</td>
                      <td>{formatDps(skill.damage / seconds)}</td>
                      <td>{formatInteger(skill.hits)}</td>
                      <td>{skill.hits > 0 ? formatPercent(skill.crits / skill.hits) : "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>}
          </td>
        </tr>
      )}
    </>
  );
}
