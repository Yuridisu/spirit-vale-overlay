import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DesktopView } from "@svoverlay/desktop-runtime/view";
import { TitleBar } from "@svoverlay/ui-kit/title-bar";
import { ensureInitialWindowSize } from "@svoverlay/ui-kit/ensure-window-size";
import { SettingsButton } from "@svoverlay/ui-kit/settings-button";
import { repairRendererPayload } from "@svoverlay/ui-kit/renderer-text";
import { CustomSelect } from "@svoverlay/ui-kit/custom-select";
import { CheckIcon, ExternalIcon } from "@svoverlay/ui-kit/icons";
import { useTranslator } from "@svoverlay/i18n/browser";
import type { Translator } from "@svoverlay/i18n/translate";
import type { BuildGuideSkillCell, BuildGuideSquare } from "@svoverlay/contracts/build-guide";

import type { BuildGuideItemView, BuildGuideRpc, BuildGuideSelected, BuildGuideState } from "../app-types.ts";
import type { BuildSort } from "../spiritvalers-client.ts";

const MINIMUM_WIDTH = 860;
const MINIMUM_HEIGHT = 560;
const SORTS: readonly BuildSort[] = ["trending", "liked", "recent"];
type Tab = "skills" | "farm" | "attributes";
// A view can be opened on a tab (?tab=farm); the app opens it on Skills.
const requestedTab = new URLSearchParams(location.search).get("tab");
const initialTab: Tab = requestedTab === "farm" || requestedTab === "attributes" ? requestedTab : "skills";

let setStateExternal: ((next: BuildGuideState) => void) | undefined;
const rpc = DesktopView.defineRPC<BuildGuideRpc>({
  handlers: { requests: {}, messages: { stateChanged: (next) => setStateExternal?.(repairRendererPayload(next)) } },
});
const desktopView = new DesktopView({ rpc });
void ensureInitialWindowSize(desktopView.rpc?.request, { width: MINIMUM_WIDTH, height: MINIMUM_HEIGHT });

const skillIcon = (sprite: string | undefined) => (sprite ? `views://assets/status-icons/${sprite}.webp` : undefined);
const percent = (value: number) => `${value >= 1 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100}%`;

function App() {
  const t = useTranslator();
  const [state, setState] = useState<BuildGuideState>();
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    setStateExternal = setState;
    void desktopView.rpc?.request.getState({}).then((next) => setState(repairRendererPayload(next)));
    return () => { setStateExternal = undefined; };
  }, []);
  const update = async (request: Promise<BuildGuideState | undefined> | undefined) => {
    const next = await request;
    if (next) setState(repairRendererPayload(next));
  };
  const request = desktopView.rpc?.request;

  return <div class="app-shell">
    <TitleBar appTag={t("buildGuide.window.tag")} minWidth={MINIMUM_WIDTH} minHeight={MINIMUM_HEIGHT}
      getFrame={() => desktopView.rpc!.request.getWindowFrame({})}
      setFrame={(frame) => desktopView.rpc?.request.setWindowFrame(frame)}
      onMinimize={() => void request?.windowAction({ action: "minimize" })}
      onClose={() => void request?.windowAction({ action: "close" })}
      extraControls={<SettingsButton onClick={() => void request?.openSettings({})} />}
    />
    <div class="guide-body">
      <aside class="library" aria-label={t("buildGuide.library.label")}>
        <div class="library-head">
          <div class="class-line">
            <span class="tag">{state?.className || "—"}</span>
            {state && <span class="class-note">{state.classPicked ? t("buildGuide.class.picked") : state.character ? t("buildGuide.class.yours") : t("buildGuide.class.none")}</span>}
          </div>
          {state && state.classes.length > 0 && (
            <CustomSelect
              ariaLabel={t("buildGuide.class.label")}
              value={state.classPicked ? state.className : ""}
              options={[
                { value: "", label: state.character ? t("buildGuide.class.follow", { cls: state.character.cls || "—" }) : t("buildGuide.class.followNone") },
                ...state.classes.map((name) => ({ value: name, label: name })),
              ]}
              onChange={(value) => void update(request?.setClass(value ? { className: value } : {}))}
            />
          )}
          <div class="seg" role="group" aria-label={t("buildGuide.sort.label")}>
            {SORTS.map((sort) => (
              <button key={sort} type="button" class={state?.sort === sort ? "active" : undefined} aria-pressed={state?.sort === sort}
                onClick={() => void update(request?.setSort({ sort }))}>{t(`buildGuide.sort.${sort}`)}</button>
            ))}
          </div>
        </div>
        <div class="library-list" aria-busy={state?.libraryLoading}>
          {state?.libraryError && <p class="library-note is-error">{t("buildGuide.library.error", { detail: state.libraryError })}</p>}
          {!state || (state.libraryLoading && state.library.length === 0)
            ? <p class="library-note">{t("buildGuide.library.loading")}</p>
            : state.library.length === 0
              ? <p class="library-note">{t("buildGuide.library.empty", { cls: state.className })}</p>
              : state.library.map((row) => (
                <button key={row.id} type="button" class={`build-row${state.selected?.id === row.id ? " is-active" : ""}`}
                  aria-pressed={state.selected?.id === row.id} onClick={() => void update(request?.selectBuild({ id: row.id }))}>
                  <strong>{row.name}</strong>
                  <span>{t("buildGuide.library.by", { author: row.author })}</span>
                  <span class="build-row-meta">
                    <b>{row.likes.toLocaleString()}</b> {t("buildGuide.library.likes")}
                    {row.level ? <> · {t("buildGuide.library.level", { level: row.level })}</> : null}
                  </span>
                </button>
              ))}
        </div>
      </aside>

      <main class="detail">
        {state?.selectedError && <div class="banner is-error">{t("buildGuide.build.error", { detail: state.selectedError })}</div>}
        {!state?.selected
          ? <div class="empty-state">{state?.selectedLoading ? t("buildGuide.build.loading") : t("buildGuide.build.pick")}</div>
          : <Selected t={t} selected={state.selected} guiding={state.guiding} tab={tab} onTab={setTab}
            onStage={(stage) => void update(request?.setStage({ stage }))}
            onGuiding={(guiding) => void update(request?.setGuiding({ guiding }))}
            onOpen={() => void request?.openOnSite({})} />}
        <footer class="credit">{t("buildGuide.credit")}</footer>
      </main>
    </div>
  </div>;
}

function Selected({ t, selected, guiding, tab, onTab, onStage, onGuiding, onOpen }: {
  t: Translator;
  selected: BuildGuideSelected;
  guiding: boolean;
  tab: Tab;
  onTab: (tab: Tab) => void;
  onStage: (stage: number) => void;
  onGuiding: (guiding: boolean) => void;
  onOpen: () => void;
}) {
  return <>
    <header class="build-head">
      <div class="build-title">
        <h1>{selected.name}</h1>
        <p>{t("buildGuide.library.by", { author: selected.author })}{selected.level ? <> · {t("buildGuide.library.level", { level: selected.level })}</> : null}{selected.jobLevel ? <> · {t("buildGuide.build.job", { level: selected.jobLevel })}</> : null}</p>
      </div>
      <div class="build-actions">
        <button type="button" class="btn" onClick={onOpen}><ExternalIcon /> {t("buildGuide.build.open")}</button>
        <button type="button" class={guiding ? "btn active" : "btn btn-primary"} aria-pressed={guiding} onClick={() => onGuiding(!guiding)}>
          {guiding ? <><CheckIcon /> {t("buildGuide.build.guiding")}</> : t("buildGuide.build.guide")}
        </button>
      </div>
    </header>
    {selected.stages.length > 1 && (
      <div class="stage-line">
        <span class="t-label">{t("buildGuide.build.stage")}</span>
        <CustomSelect ariaLabel={t("buildGuide.build.stage")} value={String(selected.stage)}
          options={selected.stages.map((name, index) => ({ value: String(index), label: name }))}
          onChange={(value) => onStage(Number(value))} />
      </div>
    )}
    <div class="seg tabs" role="tablist">
      {(["skills", "farm", "attributes"] as const).map((id) => (
        <button key={id} type="button" role="tab" aria-selected={tab === id} class={tab === id ? "active" : undefined} onClick={() => onTab(id)}>
          {id === "skills" ? t("buildGuide.tab.skills", { count: selected.skills.pointsLeft })
            : id === "farm" ? t("buildGuide.tab.farm", { count: selected.missing.length })
            : t("buildGuide.tab.attributes")}
        </button>
      ))}
    </div>
    <div class="tab-panel">
      {tab === "skills" && <SkillsPanel t={t} selected={selected} />}
      {tab === "farm" && <FarmPanel t={t} selected={selected} />}
      {tab === "attributes" && <AttributesPanel t={t} selected={selected} />}
    </div>
  </>;
}

function cellState(cell: BuildGuideSkillCell): "done" | "raise" | "over" | "none" {
  if (cell.current > cell.target) return "over";
  if (cell.target > cell.current) return "raise";
  return cell.target > 0 ? "done" : "none";
}

function emptySquares(tree: { rows: number; cols: number; cells: BuildGuideSkillCell[] }): Array<[number, number]> {
  const taken = new Set(tree.cells.map((cell) => `${cell.row}:${cell.col}`));
  const squares: Array<[number, number]> = [];
  for (let row = 0; row < tree.rows; row += 1) {
    for (let col = 0; col < tree.cols; col += 1) if (!taken.has(`${row}:${col}`)) squares.push([row, col]);
  }
  return squares;
}

function SkillsPanel({ t, selected }: { t: Translator; selected: BuildGuideSelected }) {
  const { skills } = selected;
  // Opens on the tab the next raise is on, as the game would need to be.
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const tab = Math.min(picked ?? skills.next[0]?.tab ?? skills.trees.length - 1, skills.trees.length - 1);
  const tree = skills.trees[tab];
  if (!tree) return null;
  return <div class="skills-panel">
    <div class="skill-tree">
      {skills.trees.length > 1 && (
        <div class="seg tree-tabs" role="tablist" aria-label={t("buildGuide.skills.tabs")}>
          {skills.trees.map((candidate, index) => (
            <button key={candidate.className} type="button" role="tab" aria-selected={index === tab} class={index === tab ? "active" : undefined}
              onClick={() => setPicked(index)}>
              {candidate.className}{candidate.pointsLeft > 0 && <b class="tree-points">{candidate.pointsLeft}</b>}
            </button>
          ))}
        </div>
      )}
    <div class="skill-grid" style={`--cols:${tree.cols};--rows:${tree.rows}`} role="grid" aria-label={t("buildGuide.skills.grid")}>
      {/* The squares the game leaves empty, so every skill sits where the game puts it. */}
      {emptySquares(tree).map(([row, col]) => <span key={`empty-${row}-${col}`} class="skill-cell is-empty" aria-hidden="true" style={`grid-row:${row + 1};grid-column:${col + 1}`} />)}
      {tree.cells.map((cell) => {
        const status = cellState(cell);
        return <div key={cell.gameId} class={`skill-cell is-${status}`} style={`grid-row:${cell.row + 1};grid-column:${cell.col + 1}`}
          title={`${cell.name}: ${cell.current} → ${cell.target} / ${cell.maxLevel}${cell.required ? ` · ${t("buildGuide.skills.required")}` : ""}`}>
          <span class="skill-icon">{skillIcon(cell.sprite) ? <img src={skillIcon(cell.sprite)} alt="" /> : null}</span>
          <span class="skill-levels"><b>{cell.current}</b>{status === "raise" || status === "over" ? <> → <b class="skill-target">{cell.target}</b></> : null}</span>
          <span class="skill-name">{cell.name}</span>
        </div>;
      })}
    </div>
    </div>
    <section class="steps" aria-label={t("buildGuide.skills.order")}>
      <h2 class="tag">{t("buildGuide.skills.order")}</h2>
      {skills.next.length === 0
        ? <p class="steps-done"><CheckIcon /> {t("buildGuide.skills.done")}</p>
        : <ol>{skills.next.map((step) => (
          <li key={`${step.gameId}-${step.to}`}>
            {skillIcon(step.sprite) && <img src={skillIcon(step.sprite)} alt="" />}
            <span class="step-name">{step.name}{skills.trees.length > 1 && <small> · {skills.trees[step.tab]?.className}</small>}</span>
            <span class="step-levels">{step.from} → <b>{step.to}</b></span>
          </li>
        ))}</ol>}
    </section>
  </div>;
}

function FarmPanel({ t, selected }: { t: Translator; selected: BuildGuideSelected }) {
  return <div class="farm-panel">
    <section class="farm-list">
      {selected.missing.length === 0 && <p class="steps-done"><CheckIcon /> {t("buildGuide.farm.done")}</p>}
      {selected.missing.map((item) => <FarmRow key={`${item.kind}:${item.itemId}:${item.slots[0]}`} t={t} item={item} />)}
      {selected.owned.length > 0 && <p class="farm-owned">{t("buildGuide.farm.owned", { count: selected.owned.length })}</p>}
    </section>
    <WorldGrid t={t} squares={selected.squares} />
  </div>;
}

function FarmRow({ t, item }: { t: Translator; item: BuildGuideItemView }) {
  const drops = item.sources.filter((source) => source.kind === "drop").slice(0, 3);
  const crafts = item.sources.filter((source) => source.kind === "craft").slice(0, 1);
  return <article class="farm-item">
    <span class="farm-icon">{item.icon ? <img src={item.icon} alt="" /> : null}</span>
    <div class="farm-main">
      <div class="farm-name"><strong>{item.name}</strong><span class="pill">{t(`buildGuide.kind.${item.kind}` as Parameters<Translator>[0])}</span>{item.need > 1 && <span class="farm-count">{item.have}/{item.need}</span>}</div>
      {drops.map((source, index) => source.kind === "drop" && (
        <p key={index} class="farm-source">
          <b class={source.boss ? "is-boss" : undefined}>{percent(source.chance)}</b>
          {" "}{t("buildGuide.farm.from", { monster: source.monster, level: source.level })}
          {" · "}{t("buildGuide.farm.kills", { count: source.expectedKills.toLocaleString() })}
          {source.maps.length > 0 && <span class="farm-maps"> · {source.maps.map((map) => map.name).join(", ")}</span>}
        </p>
      ))}
      {crafts.map((source, index) => source.kind === "craft" && (
        <p key={`craft-${index}`} class="farm-source">
          <b class="is-craft">{t("buildGuide.farm.craft")}</b> {source.crafter}{source.materials.length > 0 && <> · {source.materials.map((material) => `${material.name} ×${material.count.toLocaleString()}`).join(", ")}</>}
        </p>
      ))}
      {drops.length === 0 && crafts.length === 0 && <p class="farm-source is-unknown">{t("buildGuide.farm.unknown")}</p>}
    </div>
  </article>;
}

/** Where the missing items drop, on the world map's own grid. */
function WorldGrid({ t, squares }: { t: Translator; squares: BuildGuideSquare[] }) {
  if (squares.length === 0) return null;
  const rows = Math.max(...squares.map((square) => square.row), 10);
  const cols = Math.max(...squares.map((square) => square.col), 11);
  return <section class="world" aria-label={t("buildGuide.farm.map")}>
    <h2 class="tag">{t("buildGuide.farm.map")}</h2>
    <div class="world-grid" style={`--rows:${rows};--cols:${cols}`}>
      {squares.map((square) => (
        <span key={`${square.row}-${square.col}`} class="world-square" style={`grid-row:${square.row};grid-column:${square.col};--weight:${Math.min(1, square.items / 4)}`}
          title={`${square.name} · Lv ${square.minLevel}-${square.maxLevel} · ${t("buildGuide.farm.squareItems", { count: square.items })}`}>
          {square.items}
        </span>
      ))}
    </div>
    <ul class="world-legend">
      {squares.slice(0, 6).map((square) => <li key={square.name}><b>{square.items}</b> {square.name} <span>Lv {square.minLevel}-{square.maxLevel}</span></li>)}
    </ul>
  </section>;
}

function AttributesPanel({ t, selected }: { t: Translator; selected: BuildGuideSelected }) {
  return <div class="table-scroll attributes">
    <table class="data-table">
      <thead><tr><th>{t("buildGuide.attributes.name")}</th><th>{t("buildGuide.attributes.current")}</th><th>{t("buildGuide.attributes.target")}</th><th>{t("buildGuide.attributes.left")}</th></tr></thead>
      <tbody>{selected.attributes.map((attribute) => {
        const left = attribute.current === undefined ? undefined : attribute.target - attribute.current;
        return <tr key={attribute.name}>
          <th scope="row">{attribute.name}</th>
          <td>{attribute.current ?? "—"}</td>
          <td>{attribute.target}</td>
          <td class={left !== undefined && left > 0 ? "is-left" : undefined}>{left === undefined ? "—" : left > 0 ? `+${left}` : left === 0 ? <CheckIcon label={t("buildGuide.attributes.reached")} /> : left}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}

render(<App />, document.getElementById("root")!);
