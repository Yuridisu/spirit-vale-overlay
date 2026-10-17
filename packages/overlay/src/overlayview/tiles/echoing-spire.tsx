import { useEffect, useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDuration } from "@svoverlay/ui-kit/format";
import {
  ECHOING_SPIRE_BOSS_EVERY,
  ECHOING_SPIRE_FLOORS,
  isSpireBossFloor,
  nextSpireBossFloor,
  type EchoingSpireBoss,
  type EchoingSpireFloor,
  type EchoingSpireState,
} from "@svoverlay/contracts/echoing-spire";
import { echoingSpireState } from "../store.ts";
import { BossHealthBar } from "./boss-meter.tsx";

/** The floors listed under the run, newest first. */
const RECENT_FLOORS = 4;

/**
 * Echoing Spire: the floor out of 105 and the climb so far, the boss on every fifth floor with its
 * health and fight, the Umbral curse to watch for, and the last few floors' times.
 */
export function EchoingSpireElement() {
  const t = useTranslator();
  const state = echoingSpireState.value;
  // The run and floor clocks, and the mark's countdown, move every second while in the Spire.
  const [, setTick] = useState(0);
  const inSpire = state?.inSpire ?? false;
  useEffect(() => {
    if (!inSpire) return;
    const timer = setInterval(() => setTick((tick) => tick + 1), 1_000);
    return () => clearInterval(timer);
  }, [inSpire]);
  const nowMs = Date.now();
  if (!state?.run) {
    return (
      <div class="element-content spire">
        <h2 class="element-title">{t("overlay.spire.title")}</h2>
        <div class="empty">
          <span>{t("overlay.spire.waiting")}</span>
          <span class="empty-help">{t("overlay.spire.waitingHelp")}</span>
        </div>
      </div>
    );
  }
  const run = state.run;
  const current = run.floors.at(-1);
  const floor = state.floor ?? current?.floor;
  const endMs = run.leftAtMs ?? nowMs;
  const bossFloor = isSpireBossFloor(floor);
  return (
    <div class="element-content spire">
      <div class="spire-head">
        <h2 class="element-title">{t("overlay.spire.title")}</h2>
        <span class="spire-floor">
          {floor === undefined ? "—" : <><strong>{floor}</strong><small>/{ECHOING_SPIRE_FLOORS}</small></>}
        </span>
      </div>
      <SpireProgress floor={floor} />
      <div class="spire-clocks">
        <span>{t("overlay.spire.run", { time: formatDuration(endMs - run.startedAtMs) })}</span>
        {current && <span>{t("overlay.spire.floorTime", { time: formatDuration((current.endedAtMs ?? endMs) - current.startedAtMs) })}</span>}
        {!inSpire
          ? <span class="spire-away">{t("overlay.spire.away")}</span>
          : floor !== undefined && !bossFloor && <span class="spire-next">{t("overlay.spire.nextBoss", { floor: nextSpireBossFloor(floor) })}</span>}
      </div>
      {current && (
        <div class="spire-gains">
          <span>{t("overlay.spire.kills", { kills: current.kills })}</span>
          {current.experience > 0 && <span>{t("overlay.spire.xp", { xp: formatCompact(current.experience) })}</span>}
          {current.coins > 0 && <span>{t("overlay.spire.gold", { gold: formatCompact(current.coins) })}</span>}
        </div>
      )}
      {inSpire && (bossFloor || state.bosses.length > 0) && <SpireBosses bosses={state.bosses} nowMs={nowMs} />}
      {inSpire && <SpireCurse curse={state.curse} nowMs={nowMs} />}
      <SpireFloors floors={run.floors} endMs={endMs} />
      {state.history[0] && <SpireLastRun history={state.history} />}
    </div>
  );
}

/** The climb as one bar, a notch at every boss floor. */
function SpireProgress({ floor }: { floor: number | undefined }) {
  const share = floor === undefined ? 0 : Math.min(1, floor / ECHOING_SPIRE_FLOORS);
  return (
    <div class="spire-progress" style={`--climb:${share};--notch:${100 / (ECHOING_SPIRE_FLOORS / ECHOING_SPIRE_BOSS_EVERY)}%`} aria-hidden="true">
      <div class="spire-progress-fill" />
    </div>
  );
}

function SpireBosses({ bosses, nowMs }: { bosses: EchoingSpireBoss[]; nowMs: number }) {
  const t = useTranslator();
  return (
    <section class="spire-boss">
      <div class="spire-boss-heading">
        <span class="spire-boss-tag">{t("overlay.spire.bossFloor")}</span>
        {bosses.length === 0 && <span class="spire-boss-wait">{t("overlay.spire.bossWaiting")}</span>}
      </div>
      {bosses.map((boss, index) => (
        <div class={`spire-boss-row${boss.status === "dead" ? " is-dead" : ""}`} key={`${boss.name}-${index}`}>
          <div class="spire-boss-line">
            <span class="spire-boss-name">{boss.name}</span>
            <span class="spire-boss-time">{bossTime(t, boss, nowMs)}</span>
          </div>
          {boss.status === "alive" && <BossHealthBar health={boss.health} />}
        </div>
      ))}
    </section>
  );
}

function bossTime(t: ReturnType<typeof useTranslator>, boss: EchoingSpireBoss, nowMs: number): string {
  if (boss.status === "dead") {
    return boss.firstHitAtMs !== undefined && boss.diedAtMs !== undefined
      ? t("overlay.spire.defeated", { time: formatDuration(boss.diedAtMs - boss.firstHitAtMs) })
      : t("overlay.spire.defeatedNoTime");
  }
  return boss.firstHitAtMs === undefined ? "" : t("overlay.spire.fight", { time: formatDuration(nowMs - boss.firstHitAtMs) });
}

/** What the Umbral curse has in store: Manifestations to come and already out, and the mark on you. */
function SpireCurse({ curse, nowMs }: { curse: EchoingSpireState["curse"]; nowMs: number }) {
  const t = useTranslator();
  const markLeftMs = curse.markExpiresAtMs === undefined ? undefined : curse.markExpiresAtMs - nowMs;
  const marked = curse.marked && (markLeftMs === undefined || markLeftMs > 0);
  if (curse.manifestations === 0 && curse.cursedPlayers === 0 && !curse.selfCursed && !marked) return null;
  return (
    <div class="spire-curse">
      {curse.manifestations > 0 && (
        <span class="spire-alert is-danger">
          {t(curse.manifestations === 1 ? "overlay.spire.manifestation" : "overlay.spire.manifestations", { count: curse.manifestations })}
        </span>
      )}
      {marked && (
        <span class="spire-alert is-danger">
          {markLeftMs === undefined ? t("overlay.spire.marked") : t("overlay.spire.markedTime", { time: formatDuration(markLeftMs) })}
        </span>
      )}
      {curse.selfCursed && <span class="spire-alert is-curse">{t("overlay.spire.selfCursed")}</span>}
      {curse.cursedPlayers > 0 && (
        <span class="spire-alert is-curse">
          {t(curse.cursedPlayers === 1 ? "overlay.spire.cursedOne" : "overlay.spire.cursed", { count: curse.cursedPlayers })}
        </span>
      )}
    </div>
  );
}

/** The floors before this one, newest first: time, kills, and a boss floor's boss. */
function SpireFloors({ floors, endMs }: { floors: EchoingSpireFloor[]; endMs: number }) {
  const t = useTranslator();
  const done = floors.slice(0, -1).slice(-RECENT_FLOORS).reverse();
  if (done.length === 0) return null;
  return (
    <div class="spire-floors">
      {done.map((floor) => {
        const boss = floor.bosses[0];
        return (
          <div class={`spire-floor-row${isSpireBossFloor(floor.floor) ? " is-boss" : ""}`} key={floor.floor}>
            <span class="spire-floor-number">{t("overlay.spire.floorShort", { floor: floor.floor })}</span>
            <span class="spire-floor-detail">
              {boss
                ? boss.fightMs === undefined ? boss.name : t("overlay.spire.bossKill", { boss: boss.name, time: formatDuration(boss.fightMs) })
                : t("overlay.spire.kills", { kills: floor.kills })}
            </span>
            <span class="spire-floor-time">{formatDuration((floor.endedAtMs ?? endMs) - floor.startedAtMs)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SpireLastRun({ history }: { history: EchoingSpireState["history"] }) {
  const t = useTranslator();
  const last = history[0]!;
  const best = Math.max(...history.map((run) => run.lastFloor ?? 0));
  return (
    <div class="spire-last">
      {t("overlay.spire.lastRun", {
        from: last.firstFloor ?? "?",
        to: last.lastFloor ?? "?",
        time: formatDuration(last.endedAtMs - last.startedAtMs),
        kills: last.kills,
      })}
      {best > 0 && history.length > 1 && <span>{t("overlay.spire.best", { floor: best })}</span>}
    </div>
  );
}
