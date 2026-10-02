import { Coins, History, RotateCcw, Trash2 } from "lucide-preact";
import { useState } from "preact/hooks";
import type { DesktopState, GoldAnalyticsView, GoldSessionSummaryView } from "../shared/contracts.ts";

import { compactMoney, exactMoney } from "./format.ts";

const apiRoot = window.location.origin;

export function GoldWorkspace({ state, connectionError, refreshState }: {
  state: DesktopState | undefined;
  connectionError: string | undefined;
  refreshState: () => Promise<void>;
}) {
  const [busyAction, setBusyAction] = useState<"reset" | "clear">();
  const [deletingSessionId, setDeletingSessionId] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const gold = state?.gold;

  const reset = async () => {
    setBusyAction("reset");
    setActionError(undefined);
    try {
      const response = await fetch(`${apiRoot}/v1/gold/reset`, { method: "POST" });
      if (!response.ok) throw new Error(`Reset failed (${response.status})`);
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(undefined);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("Delete all saved gold sessions? This cannot be undone.")) return;
    setBusyAction("clear");
    setActionError(undefined);
    try {
      const response = await fetch(`${apiRoot}/v1/gold/history`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Clear history failed (${response.status})`);
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(undefined);
    }
  };

  const deleteSession = async (session: GoldSessionSummaryView) => {
    if (!window.confirm(`Delete the gold session finished ${new Date(session.endedAt).toLocaleString()}?`)) return;
    setDeletingSessionId(session.id);
    setActionError(undefined);
    try {
      const response = await fetch(`${apiRoot}/v1/gold/history/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Delete failed (${response.status})`);
      await refreshState();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeletingSessionId(undefined);
    }
  };

  return (
    <div class="gold-module">
      <header class="module-toolbar gold-toolbar">
        <div><span class="eyebrow">Session ledger</span><strong>Gold analytics</strong></div>
        <div class="gold-session-state">
          <span class={`capture-pulse ${gold?.status === "tracking" ? "live" : ""}`} />
          {gold?.status === "tracking" ? `Tracking · ${duration(gold.elapsedSeconds)}`
            : gold?.status === "paused" ? `Paused · game not running · ${duration(gold.elapsedSeconds)}`
            : "Waiting for gold balance"}
        </div>
        <button class="gold-reset" type="button" disabled={!gold || gold.status === "waiting" || busyAction !== undefined} onClick={() => void reset()}>
          <RotateCcw size={13} />{busyAction === "reset" ? "Saving" : "Finish session"}
        </button>
      </header>

      <main class="gold-workspace">
        {(connectionError || actionError) && <div class="notice error"><span>{connectionError ?? actionError}</span></div>}
        {!connectionError && state && state.phase !== "capturing" && <div class="notice"><span>{state.detail}. Gold analytics begin when the game sends a balance update.</span></div>}
        {!gold || gold.status === "waiting" ? <WaitingForGold hasHistory={Boolean(gold?.previousSessions.length)} /> : <GoldLedger gold={gold} />}
        {gold && <SessionHistory sessions={gold.previousSessions} clearing={busyAction === "clear"} deletingSessionId={deletingSessionId} onClear={clearHistory} onDelete={deleteSession} />}
      </main>
    </div>
  );
}

function WaitingForGold({ hasHistory }: { hasHistory: boolean }) {
  return <section class={`gold-waiting ${hasHistory ? "with-history" : ""}`}><Coins size={34} strokeWidth={1.3} /><h1>Waiting for the first coin count</h1><p>Keep capture running and enter a character. The initial balance becomes the session baseline; nothing is read from memory or sent off-device.</p></section>;
}

function GoldLedger({ gold }: { gold: GoldAnalyticsView }) {
  const maximumBucket = Math.max(1, ...gold.buckets.flatMap((bucket) => [bucket.earned, bucket.spent]));
  return (
    <div class="gold-ledger">
      <section class="gold-assay" aria-label="Gold rate overview">
        <div class="gold-rate">
          <span>Gross rate · {duration(gold.elapsedSeconds)} sample</span>
          <strong title={exactMoney(gold.goldPerHour)}>{compactMoney(gold.goldPerHour)}</strong>
          <small>gold / hour · current balance excluded</small>
        </div>
        <dl class="gold-assay-meta">
          <div><dt>15 min pace</dt><dd title={exactMoney(gold.recentGoldPerHour)}>{compactMoney(gold.recentGoldPerHour)}<small>/ hr</small></dd></div>
          <div><dt>Gold / minute</dt><dd title={exactMoney(gold.goldPerMinute)}>{compactMoney(gold.goldPerMinute)}</dd></div>
          <div><dt>Current balance</dt><dd title={exactMoney(gold.balance ?? 0)}>{compactMoney(gold.balance ?? 0)}</dd></div>
        </dl>
        <div class="gold-pulse-chart" role="img" aria-label="Gold earned and spent in five-minute intervals over the last hour">
          <div class="gold-chart-label"><span>Last hour</span><span>5 minute intervals</span></div>
          <div class="gold-chart-rule" />
          <div class="gold-bars">
            {gold.buckets.map((bucket) => <div class="gold-bar-slot" title={`${clock(bucket.startedAt)} · +${exactMoney(bucket.earned)} · −${exactMoney(bucket.spent)}`}>
              <i class="gain" style={{ height: `${Math.max(bucket.earned > 0 ? 3 : 0, bucket.earned / maximumBucket * 44)}%` }} />
              <i class="loss" style={{ height: `${Math.max(bucket.spent > 0 ? 3 : 0, bucket.spent / maximumBucket * 44)}%` }} />
            </div>)}
          </div>
          <div class="gold-chart-key"><span class="gain">Earned</span><span class="loss">Spent</span><span>Now</span></div>
        </div>
      </section>

      <section class="gold-totals" aria-label="Session totals">
        <Metric label="Earned" value={gold.earned} signed="positive" tone="gain" note={`${gold.earningEvents} earning event${gold.earningEvents === 1 ? "" : "s"}`} />
        <Metric label="Spent" value={gold.spent} signed="negative" tone="loss" note={`${gold.spendingEvents} spending event${gold.spendingEvents === 1 ? "" : "s"}`} />
        <Metric label="Net change" value={gold.net} signed="auto" tone={gold.net >= 0 ? "gain" : "loss"} note={`${signedCompact(gold.netPerHour)} / hour`} />
        <Metric label="Average gain" value={gold.averageGoldPerEvent} note="per earning event" />
      </section>

      <section class="gold-efficiency">
        <header><div><span class="eyebrow">Efficiency</span><h2>Run yield</h2></div><span class="gold-clock">{gold.startedAt ? `Started ${clock(gold.startedAt)}` : "Waiting for baseline"}</span></header>
        <dl>
          <div><dt>Recorded monster kills</dt><dd title={exactMoney(gold.monsterKills)}>{gold.killCountAvailable ? compactMoney(gold.monsterKills) : "—"}</dd></div>
          <div><dt>Gold / confirmed kill</dt><dd title={gold.goldPerMonsterKill === null ? undefined : exactMoney(gold.goldPerMonsterKill)}>{gold.goldPerMonsterKill === null ? "Awaiting gold" : compactMoney(gold.goldPerMonsterKill)}</dd></div>
          <div><dt>Session length</dt><dd>{duration(gold.elapsedSeconds)}</dd></div>
          <div><dt>Last gold change</dt><dd>{gold.lastChangeAt ? clock(gold.lastChangeAt) : "No change yet"}</dd></div>
        </dl>
        <p>{gold.unconfirmedMonsterKills > 0
          ? `${exactMoney(gold.unconfirmedMonsterKills)} recorded kill${gold.unconfirmedMonsterKills === 1 ? "" : "s"} await the next gold balance update. The per-kill figure only uses kills paired with observed gold.`
          : "Kill efficiency uses the cumulative monster count included in character snapshots. It appears only after that count is observed and may update less often than gold."}</p>
      </section>
    </div>
  );
}

function Metric({ label, value, signed, tone = "", note }: {
  label: string;
  value: number;
  signed?: "positive" | "negative" | "auto";
  tone?: string;
  note: string;
}) {
  const display = signed === "positive" ? `+${compactMoney(value)}`
    : signed === "negative" ? `−${compactMoney(value)}`
      : signed === "auto" ? signedCompact(value)
        : compactMoney(value);
  return <div class={tone}><span>{label}</span><strong title={exactMoney(value)}>{display}</strong><small>{note}</small></div>;
}

function SessionHistory({ sessions, clearing, deletingSessionId, onClear, onDelete }: {
  sessions: GoldSessionSummaryView[];
  clearing: boolean;
  deletingSessionId: string | undefined;
  onClear: () => Promise<void>;
  onDelete: (session: GoldSessionSummaryView) => Promise<void>;
}) {
  return <section class="gold-history">
    <header>
      <div><History size={15} /><span><b>Previous sessions</b><small>{sessions.length === 0 ? "Finished runs will be saved here" : `${sessions.length} saved run${sessions.length === 1 ? "" : "s"}`}</small></span></div>
      {sessions.length > 0 && <button type="button" disabled={clearing} onClick={() => void onClear()}><Trash2 size={12} />{clearing ? "Clearing" : "Clear history"}</button>}
    </header>
    {sessions.length === 0 ? <p class="gold-history-empty">Finish a session to preserve its rate, yield, spend, and kill efficiency.</p> : <div class="gold-history-scroll">
      <table>
        <thead><tr><th>Finished</th><th>Duration</th><th class="numeric">Earned</th><th class="numeric">Spent</th><th class="numeric">Net</th><th class="numeric">Gold / hr</th><th class="numeric">Kills</th><th class="numeric">Gold / kill</th><th class="session-actions"><span class="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{sessions.map((session) => <tr key={session.id}>
          <td><strong>{new Date(session.endedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</strong><small>{clock(session.endedAt)}</small></td>
          <td>{duration(session.elapsedSeconds)}</td>
          <td class="numeric gain" title={exactMoney(session.earned)}>+{compactMoney(session.earned)}</td>
          <td class="numeric loss" title={exactMoney(session.spent)}>−{compactMoney(session.spent)}</td>
          <td class={`numeric ${session.net >= 0 ? "gain" : "loss"}`} title={exactMoney(session.net)}>{signedCompact(session.net)}</td>
          <td class="numeric" title={exactMoney(session.goldPerHour)}>{compactMoney(session.goldPerHour)}</td>
          <td class="numeric">{compactMoney(session.monsterKills)}</td>
          <td class="numeric" title={session.goldPerMonsterKill === null ? undefined : exactMoney(session.goldPerMonsterKill)}>{session.goldPerMonsterKill === null ? "—" : compactMoney(session.goldPerMonsterKill)}</td>
          <td class="session-actions"><button type="button" title="Delete this session" aria-label={`Delete session finished ${new Date(session.endedAt).toLocaleString()}`} disabled={deletingSessionId !== undefined || clearing} onClick={() => void onDelete(session)}><Trash2 size={12} />{deletingSessionId === session.id && <span class="visually-hidden">Deleting</span>}</button></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}

function signedCompact(value: number): string {
  return `${value >= 0 ? "+" : "−"}${compactMoney(value)}`;
}

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor(seconds % 3_600 / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${remaining}s`;
}

function clock(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
