import { useState } from "preact/hooks";
import { isSpireBossFloor, type EchoingSpireFloor, type EchoingSpireRun } from "@svoverlay/contracts/echoing-spire";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDps, formatDuration, formatInteger } from "@svoverlay/ui-kit/format";

const startedFormat = new Intl.DateTimeFormat(undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** When a run stopped: over, left, or (still climbing) the last floor's end. */
function runEndMs(run: EchoingSpireRun): number | undefined {
  return run.endedAtMs ?? run.leftAtMs ?? run.floors.at(-1)?.endedAtMs;
}

/** A floor's time, from its first monsters to the next floor's; the floor being climbed has none yet. */
function floorMs(floor: EchoingSpireFloor): number | undefined {
  return floor.endedAtMs === undefined ? undefined : floor.endedAtMs - floor.startedAtMs;
}

/**
 * Echoing Spire runs on record: each floor climbed, how long it took and its kills, and on a boss
 * floor each boss, how long it took to fall from its first hit, and the party's damage per second.
 */
export function SpirePanel({ runs }: { runs: readonly EchoingSpireRun[] }) {
  const t = useTranslator();
  const [selectedAt, setSelectedAt] = useState<number | undefined>(undefined);
  const run = runs.find((candidate) => candidate.startedAtMs === selectedAt) ?? runs[0];

  if (!run) return <section class="boss-screen"><div class="empty-state">{t("combat.spire.empty")}</div></section>;

  const floors = [...run.floors].reverse();
  const done = run.floors.filter((floor) => floor.endedAtMs !== undefined);
  const climbedMs = done.reduce((total, floor) => total + floorMs(floor)!, 0);
  const endMs = runEndMs(run);

  return (
    <section class="boss-screen spire-screen">
      <div class="boss-fight-layout">
        <nav class="boss-fight-list" aria-label={t("combat.spire.list.label")}>
          {runs.map((candidate) => {
            const first = candidate.floors[0]?.floor;
            const last = candidate.floors.at(-1)?.floor;
            const end = runEndMs(candidate);
            const active = candidate === runs[0] && candidate.endedAtMs === undefined && candidate.leftAtMs === undefined;
            return (
              <button
                key={candidate.startedAtMs}
                type="button"
                class={`boss-fight-item${candidate === run ? " active" : ""}`}
                aria-pressed={candidate === run}
                onClick={() => setSelectedAt(candidate.startedAtMs)}
              >
                <strong>{first === undefined ? "—" : t("combat.spire.run.floors", { from: first, to: last ?? first })}</strong>
                <span>
                  {startedFormat.format(candidate.startedAtMs)}
                  {end !== undefined && ` · ${formatDuration(end - candidate.startedAtMs)}`}
                  {active && ` · ${t("combat.spire.run.active")}`}
                </span>
              </button>
            );
          })}
        </nav>

        <div class="boss-fight-detail">
          <h2 class="boss-fight-title">
            {run.floors[0] === undefined ? "—" : t("combat.spire.run.floors", { from: run.floors[0].floor, to: run.floors.at(-1)!.floor })}
            <span class="boss-fight-map">{startedFormat.format(run.startedAtMs)}</span>
          </h2>
          <div class="table-scroll summary-table-scroll">
            <table class="data-table summary-table" aria-label={t("combat.spire.summary.label")}>
              <thead><tr>
                <th>{t("combat.spire.column.floors")}</th>
                <th>{t("combat.spire.column.time")}</th>
                <th>{t("combat.spire.column.average")}</th>
                <th>{t("combat.spire.column.kills")}</th>
                <th>{t("combat.spire.column.xp")}</th>
              </tr></thead>
              <tbody><tr>
                <td>{formatInteger(run.floors.length)}</td>
                <td>{endMs === undefined ? "—" : formatDuration(endMs - run.startedAtMs)}</td>
                <td>{done.length === 0 ? "—" : formatDuration(climbedMs / done.length)}</td>
                <td>{formatInteger(run.kills)}</td>
                <td>{formatCompact(run.experience)}</td>
              </tr></tbody>
            </table>
          </div>

          <div class="table-scroll meter-table-scroll">
            <table class="data-table meter-table spire-floor-table" aria-label={t("combat.spire.floors.label")}>
              <thead><tr>
                <th>{t("combat.spire.column.floor")}</th>
                <th>{t("combat.spire.column.time")}</th>
                <th>{t("combat.spire.column.kills")}</th>
                <th>{t("combat.spire.column.boss")}</th>
                <th>{t("combat.spire.column.bossTime")}</th>
                <th>{t("combat.spire.column.dps")}</th>
              </tr></thead>
              <tbody>
                {floors.map((floor) => {
                  const time = floorMs(floor);
                  const bosses = floor.bosses;
                  return (
                    <tr key={floor.floor} class={isSpireBossFloor(floor.floor) || bosses.length > 0 ? "spire-boss-floor" : undefined}>
                      <td>{t("combat.spire.floor", { floor: floor.floor })}</td>
                      <td>{time === undefined ? t("combat.spire.inProgress") : formatDuration(time)}</td>
                      <td>{formatInteger(floor.kills)}</td>
                      <td>{bosses.length === 0 ? "—" : bosses.map((boss, index) => <div key={index}>{boss.name}</div>)}</td>
                      <td>{bosses.length === 0 ? "—" : bosses.map((boss, index) => <div key={index}>{boss.fightMs === undefined ? "—" : formatDuration(boss.fightMs)}</div>)}</td>
                      <td>
                        {bosses.length === 0 ? "—" : bosses.map((boss, index) => (
                          <div key={index}>
                            {boss.fightMs === undefined || boss.damage === undefined || boss.damage <= 0
                              ? "—"
                              : formatDps(boss.damage / Math.max(1, boss.fightMs / 1_000))}
                          </div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
