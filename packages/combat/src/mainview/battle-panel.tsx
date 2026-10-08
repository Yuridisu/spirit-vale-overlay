import { useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import { formatCompact, formatDuration } from "@svoverlay/ui-kit/format";
import type { BattleAnalysisView, BattleItemPart, BattleSetRow } from "../battle-analysis.ts";

type BattleTab = "sources" | "items" | "sets";

/** Below this much fighting a set's damage per second swings too much to compare. */
const SHORT_SAMPLE_SEC = 60;

/** Each element in the theme colour that already means it; the four the theme has no colour for keep their own hue. */
const ELEMENT_COLORS: Record<string, string> = {
  Neutral: "var(--outline)", Poison: "var(--violet)", Fire: "var(--flame)", Water: "var(--sky)", Wind: "var(--lime)", Holy: "var(--gold)",
  Earth: "#c49a5a", Shadow: "#6b6f86", Undead: "#8fa39b", Ghost: "#c9b6ff",
};
const elementColor = (name: string): string => ELEMENT_COLORS[name] ?? "var(--outline)";

const pct = (share: number, digits = 0): string => {
  const value = share * 100;
  return `${value > 0 && value < 1 && digits === 0 ? value.toFixed(1) : value.toFixed(digits)}%`;
};

/**
 * Battle Analysis: the player's damage by source, what each worn item is worth (measured, split or
 * estimated), and damage per second for each gear set fought in.
 */
export function BattlePanel({ view, onReset }: { view: BattleAnalysisView | undefined; onReset: (what: "session" | "sets") => void }) {
  const t = useTranslator();
  const [tab, setTab] = useState<BattleTab>("sources");
  if (!view) return <section class="battle-screen"><div class="empty-state">{t("combat.battle.loading")}</div></section>;
  return (
    <section class="battle-screen">
      <div class="battle-head">
        <div class="battle-summary">
          {view.damage > 0
            ? <><strong>{formatCompact(view.dps)}</strong> {t("combat.battle.dps")} · {formatCompact(view.damage)} · {formatDuration(view.activeSec * 1000)} {t("combat.battle.fighting")}{view.cloneShare >= 0.01 ? ` · ${t("combat.battle.byClones", { share: pct(view.cloneShare) })}` : ""}</>
            : t("combat.battle.noHits")}
        </div>
        <nav class="seg battle-tabs" role="tablist" aria-label={t("combat.battle.label")}>
          {(["sources", "items", "sets"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? "active" : undefined} onClick={() => setTab(id)}>{t(`combat.battle.tab.${id}`)}</button>
          ))}
        </nav>
        <button type="button" class="btn" onClick={() => onReset("session")} title={t("combat.battle.reset.hint")}>{t("combat.battle.reset")}</button>
      </div>
      <div class="battle-body">
        {tab === "sources" ? <Sources view={view} /> : tab === "items" ? <Items view={view} /> : <Sets view={view} onClear={() => onReset("sets")} />}
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
      {view.elements.length > 0 && (
        <div class="battle-elements">
          <div class="battle-stack">{view.elements.map((e) => <span key={e.name} style={{ width: `${(e.share * 100).toFixed(2)}%`, background: elementColor(e.name) }} />)}</div>
          <div class="battle-legend">{view.elements.filter((e) => e.share >= 0.005).map((e) => <span key={e.name}><i style={{ background: elementColor(e.name) }} />{e.name} {pct(e.share)}</span>)}</div>
        </div>
      )}
      <ul class="battle-list">
        {view.sources.map((s) => {
          const meta: string[] = [];
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
