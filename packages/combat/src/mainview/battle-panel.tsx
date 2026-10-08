import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDuration } from "@svoverlay/ui-kit/format";
import type { BattleAdviceRow, BattleAnalysisView, BattleItemPart, BattleSetRow, BattleShareRow, BattleTankView } from "../battle-analysis.ts";

type BattleTab = "sources" | "items" | "sets" | "tank" | "support";

/** Below this much fighting a set's damage per second swings too much to compare. */
const SHORT_SAMPLE_SEC = 60;

/** Each element in the theme colour that already means it; the four the theme has no colour for keep their own hue. */
const ELEMENT_COLORS: Record<string, string> = {
  Neutral: "var(--outline)", Poison: "var(--violet)", Fire: "var(--flame)", Water: "var(--sky)", Wind: "var(--lime)", Holy: "var(--gold)",
  Earth: "#c49a5a", Shadow: "#6b6f86", Undead: "#8fa39b", Ghost: "#c9b6ff",
};
const elementColor = (name: string): string => ELEMENT_COLORS[name] ?? "var(--outline)";
const TYPE_COLORS: Record<string, string> = { Physical: "var(--warning)", Magic: "var(--violet)", Status: "var(--lime)", Reflected: "var(--sky)" };
const typeColor = (name: string): string => TYPE_COLORS[name] ?? "var(--outline)";

const pct = (share: number, digits = 0): string => {
  const value = share * 100;
  return `${value > 0 && value < 1 && digits === 0 ? value.toFixed(1) : value.toFixed(digits)}%`;
};

/**
 * Battle Analysis: the player's damage by source, what each worn item is worth (measured, split or
 * estimated), and damage per second for each gear set fought in; Tank shows the damage taken and
 * reflected, Support the healing cast.
 */
export function BattlePanel({ view, onReset }: { view: BattleAnalysisView | undefined; onReset: (what: "session" | "sets") => void }) {
  const t = useTranslator();
  const [tab, setTab] = useState<BattleTab>("sources");
  if (!view) return <section class="battle-screen"><div class="empty-state">{t("combat.battle.loading")}</div></section>;
  return (
    <section class="battle-screen">
      <div class="battle-head">
        <div class="battle-summary">
          {tab === "tank"
            ? view.tank.attempts
              ? <><strong>{formatCompact(view.tank.dtps)}</strong> {t("combat.battle.dtps")} · {formatCompact(view.tank.taken)} · {formatDuration(view.tank.activeSec * 1000)} {t("combat.battle.engaged")}</>
              : t("combat.battle.tank.none")
            : tab === "support"
              ? view.support.count
                ? <><strong>{formatCompact(view.support.allyHps)}</strong> {t("combat.battle.hps")} {t("combat.battle.support.toAllies")} · {formatCompact(view.support.hps)} {t("combat.battle.hps")} {t("combat.battle.support.inAll")} · {formatDuration(view.support.activeSec * 1000)} {t("combat.battle.engaged")}</>
                : t("combat.battle.support.none")
              : view.damage > 0
                ? <><strong>{formatCompact(view.dps)}</strong> {t("combat.battle.dps")} · {formatCompact(view.damage)} · {formatDuration(view.activeSec * 1000)} {t("combat.battle.fighting")}{view.cloneShare >= 0.01 ? ` · ${t("combat.battle.byClones", { share: pct(view.cloneShare) })}` : ""}</>
                : t("combat.battle.noHits")}
        </div>
        <nav class="seg battle-tabs" role="tablist" aria-label={t("combat.battle.label")}>
          {(["sources", "items", "sets", "tank", "support"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? "active" : undefined} onClick={() => setTab(id)}>{t(`combat.battle.tab.${id}`)}</button>
          ))}
        </nav>
        <button type="button" class="btn" onClick={() => onReset("session")} title={t("combat.battle.reset.hint")}>{t("combat.battle.reset")}</button>
      </div>
      <div class="battle-body">
        {tab === "sources" ? <Sources view={view} /> : tab === "items" ? <Items view={view} /> : tab === "tank" ? <Tank view={view} /> : tab === "support" ? <Support view={view} /> : <Sets view={view} onClear={() => onReset("sets")} />}
      </div>
    </section>
  );
}

function Sources({ view }: { view: BattleAnalysisView }) {
  const t = useTranslator();
  if (!view.sources.length) return <div class="empty-state">{t("combat.battle.sources.empty")}</div>;
  const top = view.sources[0]?.damage || 1;
  return (
    <>
      {view.advice.length > 0 && (
        <Advice rows={view.advice} title={t("combat.battle.advice.title")} basis={t("combat.battle.advice.basis")} sign="+">
          {view.advice.filter((row) => row.kind === "flat").map((row) => (
            <p class="battle-meta" key={row.key}>{t("combat.battle.advice.flat", { label: row.label, gain: (row.gain * 100).toFixed(2), equals: (row.equalsPercent ?? 0).toFixed(1), now: row.now, stat: row.key === "atk-flat" ? "ATK" : "MATK" })}</p>
          ))}
          <p class="battle-hint">{t("combat.battle.advice.hint")}</p>
        </Advice>
      )}
      {view.elements.length > 0 && <Stack parts={view.elements} color={elementColor} />}
      <ul class="battle-list">
        {view.sources.map((s) => {
          const meta: string[] = [];
          if (s.formula) meta.push(t("combat.battle.formula", { level: s.formula.level, percent: s.formula.percent, stat: s.formula.scales }));
          if (s.autocasts) meta.push(t("combat.battle.autocasts", { count: s.autocasts, level: s.autocastLevels[0]?.level ?? "?" }));
          if (s.casts) meta.push(t("combat.battle.casts", { count: s.casts }));
          if (s.cloneShare >= 0.01) meta.push(t("combat.battle.byClones", { share: pct(s.cloneShare) }));
          if (s.critRate >= 0.01) meta.push(t("combat.battle.crits", { share: pct(s.critRate) }));
          if (s.multistrike) meta.push(t("combat.battle.multistrike", { count: s.multistrike.extraHits, damage: formatCompact(s.multistrike.damage) }));
          if (s.element) meta.push(s.element);
          return (
            <li class="battle-row" key={s.id}>
              <div class="battle-line"><span class="battle-name">{s.label}</span><span class="battle-num">{formatCompact(s.damage)}<small>{pct(s.share, 1)}</small></span></div>
              <div class="battle-bar"><span style={{ width: `${((s.damage / top) * 100).toFixed(1)}%` }} /></div>
              <div class="battle-meta">{meta.join(" · ")}</div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Shares of a whole as one stacked bar with a legend. */
function Stack({ parts, color }: { parts: ReadonlyArray<{ name: string; share: number }>; color: (name: string) => string }) {
  return (
    <div class="battle-elements">
      <div class="battle-stack">{parts.map((p) => <span key={p.name} style={{ width: `${(p.share * 100).toFixed(2)}%`, background: color(p.name) }} />)}</div>
      <div class="battle-legend">{parts.filter((p) => p.share >= 0.005).map((p) => <span key={p.name}><i style={{ background: color(p.name) }} />{p.name} {pct(p.share)}</span>)}</div>
    </div>
  );
}

/**
 * The stats worth raising next, the best in bold: whatever bonus is held least is worth most. The
 * sign says which way the gain goes: "+" damage dealt, "-" damage taken.
 */
function Advice({ rows, title, basis, sign, children }: { rows: readonly BattleAdviceRow[]; title: string; basis: string; sign: string; children?: ComponentChildren }) {
  const t = useTranslator();
  const ranked = rows.filter((row) => row.kind === "percent");
  const best = ranked[0]?.gain || 1;
  return (
    <div class="battle-advice">
      <div class="battle-advice-head">
        <span class="battle-name">{title}</span>
        <span class="battle-meta">{basis}</span>
      </div>
      <ul class="battle-advice-list">
        {ranked.map((row) => (
          <li key={row.key} class={row.best ? "is-best" : undefined}>
            <span class="battle-advice-label">{row.best ? <strong>{row.label}</strong> : row.label}{row.best ? <span class="battle-badge">{t("combat.battle.advice.best")}</span> : null}</span>
            <span class="battle-advice-bar"><span style={{ width: `${Math.max(4, (row.gain / best) * 100).toFixed(1)}%` }} /></span>
            <span class="battle-num">{sign}{(row.gain * 100).toFixed(2)}%<small>{t("combat.battle.advice.now", { value: row.now })}</small></span>
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/** A breakdown under a heading: per second in combat, the total and its share, and what it is made of. */
function ShareList({ title, rows, extra }: { title: string; rows: readonly BattleShareRow[]; extra?: (row: BattleShareRow) => string[] }) {
  if (!rows.length) return null;
  const top = rows[0]!.amount || 1;
  return (
    <>
      <div class="battle-section">{title}</div>
      <ul class="battle-list">
        {rows.map((row) => {
          const meta = [...(extra?.(row) ?? []), ...row.parts].filter(Boolean);
          return (
            <li class="battle-row" key={row.key}>
              <div class="battle-line"><span class="battle-name">{row.label}</span><span class="battle-num">{formatCompact(row.perSec)}/s<small>{formatCompact(row.amount)} · {pct(row.share, 1)}</small></span></div>
              <div class="battle-bar"><span style={{ width: `${((row.amount / top) * 100).toFixed(1)}%` }} /></div>
              {meta.length > 0 && <div class="battle-meta">{meta.join(" · ")}</div>}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Damage taken: what to raise against it, how hits ended, by type and element, what was reflected, who hit and who healed. */
function Tank({ view }: { view: BattleAnalysisView }) {
  const t = useTranslator();
  const tank = view.tank;
  if (!tank.attempts) return <div class="empty-state">{t("combat.battle.tank.empty")}</div>;
  const rate = (n: number) => pct(tank.attempts ? n / tank.attempts : 0, 1);
  const facts = [
    t("combat.battle.tank.hits", { count: tank.attempts, landed: tank.landed }),
    tank.crits ? t("combat.battle.tank.crits", { share: pct(tank.landed ? tank.crits / tank.landed : 0), damage: formatCompact(tank.critDamage) }) : "",
    tank.missed ? t("combat.battle.tank.missed", { share: rate(tank.missed) }) : "",
    tank.dodged ? t("combat.battle.tank.dodged", { share: rate(tank.dodged) }) : "",
    tank.blocked ? t("combat.battle.tank.blocked", { share: rate(tank.blocked) }) : "",
    tank.absorbed ? t("combat.battle.tank.absorbed", { amount: formatCompact(tank.absorbed) }) : "",
  ].filter(Boolean);
  return (
    <>
      {tank.advice.length > 0 && (
        <Advice rows={tank.advice} title={t("combat.battle.tank.advice.title")} basis={t("combat.battle.tank.advice.basis")} sign="-">
          <p class="battle-hint">{t("combat.battle.tank.advice.hint")}</p>
        </Advice>
      )}
      <div class="battle-meta">{facts.join(" · ")}</div>
      {tank.types.length > 0 && <Stack parts={tank.types} color={typeColor} />}
      {tank.elements.length > 0 && <Stack parts={tank.elements} color={elementColor} />}
      <Reflect reflect={tank.reflect} />
      <ShareList title={t("combat.battle.tank.attackers")} rows={tank.attackers} extra={(row) => [t("combat.battle.tank.hitCount", { count: row.count })]} />
      {tank.received > 0 && <ShareList title={t("combat.battle.tank.healers", { amount: formatCompact(tank.received), perSec: formatCompact(tank.receivedPerSec) })} rows={tank.healers} />}
    </>
  );
}

function Reflect({ reflect }: { reflect: BattleTankView["reflect"] }) {
  const t = useTranslator();
  return (
    <div class="battle-row battle-reflect">
      <div class="battle-line">
        <span class="battle-name">{t("combat.battle.tank.reflect.title")}</span>
        <span class="battle-num">{reflect.damage ? <>{formatCompact(reflect.perSec)}/s<small>{formatCompact(reflect.damage)} · {t("combat.battle.tank.reflect.count", { count: reflect.hits })}</small></> : "—"}</span>
      </div>
      <div class="battle-meta">
        {reflect.damage ? "" : `${t("combat.battle.tank.reflect.none")} `}
        {reflect.gear.length ? t("combat.battle.tank.reflect.gear", { lines: reflect.gear.join(", ") }) : t("combat.battle.tank.reflect.noGear")}
      </div>
    </div>
  );
}

/** Healing cast: per second on allies, on whom and with what. */
function Support({ view }: { view: BattleAnalysisView }) {
  const t = useTranslator();
  const support = view.support;
  if (!support.count) return <div class="empty-state">{t("combat.battle.support.empty")}</div>;
  const extra = (row: BattleShareRow) => [
    t("combat.battle.support.count", { count: row.count }),
    row.shields ? t("combat.battle.support.shields", { amount: formatCompact(row.shields) }) : "",
  ];
  return (
    <>
      <div class="battle-row battle-lead">
        <div class="battle-line">
          <span class="battle-name">{t("combat.battle.support.toAlliesTitle")}</span>
          <span class="battle-num">{formatCompact(support.allyHps)} {t("combat.battle.hps")}<small>{formatCompact(support.toAllies)}</small></span>
        </div>
        <div class="battle-meta">
          {t("combat.battle.support.total", { hps: formatCompact(support.hps), healing: formatCompact(support.healing) })}
          {support.shields ? ` · ${t("combat.battle.support.shields", { amount: formatCompact(support.shields) })}` : ""}
        </div>
        {support.healingGain !== undefined && (
          <div class="battle-meta">{t("combat.battle.support.healing", { gain: (support.healingGain * 100).toFixed(2), now: `${support.healingBonus > 0 ? "+" : ""}${Math.round(support.healingBonus * 10) / 10}%` })}</div>
        )}
      </div>
      <ShareList title={t("combat.battle.support.targets")} rows={support.targets} extra={extra} />
      <ShareList title={t("combat.battle.support.skills")} rows={support.skills} extra={extra} />
      <p class="battle-hint">{t("combat.battle.support.hint")}</p>
    </>
  );
}

function Tag({ kind }: { kind: BattleItemPart["kind"] }) {
  const t = useTranslator();
  return <span class={`battle-tag is-${kind}`}>{t(`combat.battle.kind.${kind}`)}</span>;
}

function Items({ view }: { view: BattleAnalysisView }) {
  const t = useTranslator();
  if (!view.hasGear) return <div class="empty-state">{t("combat.battle.items.noGear")}</div>;
  if (!view.damage) return <div class="empty-state">{t("combat.battle.items.noHits")}</div>;
  return (
    <>
      <ul class="battle-list">
        {view.items.map((item) => (
          <li class="battle-row battle-item" key={item.key}>
            <div class="battle-line">
              <span class="battle-name"><span class="battle-slot">{item.slot}</span>{item.refine ? `+${item.refine} ` : ""}{item.name}</span>
              <span class="battle-num">{item.damage ? pct(item.share, 1) : "—"}</span>
            </div>
            {item.parts.length ? item.parts.map((part, index) => (
              <div class={`battle-part is-${part.kind}`} key={index}>
                <span>{part.label}<Tag kind={part.kind} /></span>
                <span class="battle-num">{part.upTo ? "≤ " : ""}{formatCompact(part.damage)}</span>
                <div class="battle-meta">{[part.detail, part.note].filter(Boolean).join(" · ")}</div>
              </div>
            )) : <div class="battle-meta">{t("combat.battle.items.nothing")}</div>}
            {item.unmeasured.length > 0 && <div class="battle-meta">{t("combat.battle.items.unmeasured", { stats: item.unmeasured.join(", ") })}</div>}
          </li>
        ))}
      </ul>
      <p class="battle-hint">
        <Tag kind="measured" /> {t("combat.battle.kind.measured.hint")} · <Tag kind="split" /> {t("combat.battle.kind.split.hint")} · <Tag kind="estimated" /> {t("combat.battle.kind.estimated.hint")}
        {" "}{t("combat.battle.items.overlap")}
      </p>
    </>
  );
}

function Sets({ view, onClear }: { view: BattleAnalysisView; onClear: () => void }) {
  const t = useTranslator();
  if (!view.sets.length) return <div class="empty-state">{t("combat.battle.sets.empty")}</div>;
  const current = view.sets.find((set) => set.current);
  const counts = (items: readonly string[]) => items.reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map<string, number>());
  const best = Math.max(0, ...view.sets.filter((set) => set.activeSec >= SHORT_SAMPLE_SEC).map((set) => set.dps));
  const describe = (set: BattleSetRow) => {
    const left = counts(current?.items ?? []);
    const gear = set.items.map((name) => {
      const have = left.get(name) ?? 0;
      if (have > 0) left.set(name, have - 1);
      return { name, differs: Boolean(current) && !set.current && have <= 0 };
    });
    const without = set.current ? [] : [...left.entries()].flatMap(([name, n]) => Array<string>(n).fill(name));
    return { gear, without };
  };
  return (
    <>
      <p class="battle-hint">{t("combat.battle.sets.hint")}</p>
      <ul class="battle-list">
        {view.sets.map((set) => {
          const { gear, without } = describe(set);
          const short = set.activeSec < SHORT_SAMPLE_SEC;
          const delta = current && !set.current && current.dps > 0 && set.dps > 0 ? set.dps / current.dps - 1 : undefined;
          return (
            <li class={`battle-row battle-set${set.current ? " is-current" : ""}`} key={set.key}>
              <div class="battle-line">
                <span class="battle-name">{set.current ? t("combat.battle.sets.current") : t("combat.battle.sets.earlier")}{!short && set.dps === best && view.sets.length > 1 ? <span class="battle-badge">{t("combat.battle.sets.best")}</span> : null}</span>
                <span class="battle-num">{formatCompact(set.dps)} {t("combat.battle.dps")}{delta !== undefined ? <small class={delta >= 0 ? "is-better" : "is-worse"}>{delta >= 0 ? "+" : ""}{(delta * 100).toFixed(1)}%</small> : null}</span>
              </div>
              <div class="battle-meta">
                {formatDuration(set.activeSec * 1000)} {t("combat.battle.fighting")} · {formatCompact(set.damage)}
                {set.dtps > 0 ? ` · ${formatCompact(set.dtps)} ${t("combat.battle.dtps")}` : ""}
                {set.hps > 0 ? ` · ${formatCompact(set.hps)} ${t("combat.battle.hps")}` : ""}
                {set.top.length ? ` · ${set.top.map((s) => `${s.label} ${pct(s.share)}`).join(", ")}` : ""}
                {short ? <> · <span class="battle-short">{t("combat.battle.sets.short", { seconds: SHORT_SAMPLE_SEC - Math.floor(set.activeSec) })}</span></> : null}
              </div>
              <div class="battle-gear">
                {gear.map((g, index) => <span key={index} class={g.differs ? "is-diff" : undefined}>{index ? ", " : ""}{g.name}</span>)}
                {without.length > 0 && <div>{t("combat.battle.sets.without")} <span class="is-diff">{without.join(", ")}</span></div>}
              </div>
            </li>
          );
        })}
      </ul>
      <div class="battle-actions"><button type="button" class="btn" onClick={onClear}>{t("combat.battle.sets.clear")}</button></div>
    </>
  );
}
