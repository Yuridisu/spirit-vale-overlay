import { useTranslator } from "@svoverlay/i18n/browser";
import type { BuildGuideSkillCell, OverlayBuildGuideState } from "@svoverlay/contracts/build-guide";
import { buildGuideState } from "../store.ts";

const skillIcon = (sprite: string | undefined) => (sprite ? `views://assets/status-icons/${sprite}.webp` : undefined);
const percent = (value: number) => `${value >= 1 ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100}%`;

type CellState = "done" | "raise" | "over" | "none";

/** The skill window tab to show: the one the next raise is on, or the class's own when all is done. */
function currentTree(guide: OverlayBuildGuideState) {
  const { trees, next } = guide.skills;
  return trees[next[0]?.tab ?? trees.length - 1] ?? trees[0];
}
function cellState(cell: BuildGuideSkillCell): CellState {
  if (cell.current > cell.target) return "over";
  if (cell.target > cell.current) return "raise";
  return cell.target > 0 ? "done" : "none";
}

function NoBuild({ title }: { title: string }) {
  const t = useTranslator();
  return (
    <div class="element-content">
      <h2 class="element-title">{title}</h2>
      <p class="guide-waiting">{t("overlay.buildGuide.none")}</p>
    </div>
  );
}

/** The build's skill tree in small, the next raise first: a reminder that sits anywhere on screen. */
export function SkillGuideElement() {
  const t = useTranslator();
  const guide = buildGuideState.value;
  if (!guide) return <NoBuild title={t("overlay.buildGuide.skills")} />;
  const { skills } = guide;
  const next = skills.next[0];
  const tree = currentTree(guide);
  if (!tree) return <NoBuild title={t("overlay.buildGuide.skills")} />;
  return (
    <div class="element-content guide-content">
      <div class="guide-head">
        <h2 class="element-title">{t("overlay.buildGuide.skills")}</h2>
        {skills.trees.length > 1 && <span class="guide-tab">{tree.className}</span>}
        <span class="guide-points"><b>{skills.pointsLeft}</b>{t("overlay.buildGuide.points")}</span>
      </div>
      {next
        ? (
          <div class="guide-next">
            {skillIcon(next.sprite) && <img src={skillIcon(next.sprite)} alt="" />}
            <span class="guide-next-name">{next.name}</span>
            <span class="guide-next-levels">{next.from}→<b>{next.to}</b></span>
          </div>
        )
        : <p class="guide-waiting">{t("overlay.buildGuide.skillsDone")}</p>}
      <div class="guide-grid" style={`--cols:${tree.cols};--rows:${tree.rows}`}>
        {Array.from({ length: tree.rows * tree.cols }, (_, index) => (
          <span key={`empty-${index}`} class="guide-slot" style={`grid-row:${Math.floor(index / tree.cols) + 1};grid-column:${index % tree.cols + 1}`} />
        ))}
        {tree.cells.map((cell) => {
          const state = cellState(cell);
          return (
            <span key={cell.gameId} class={`guide-cell is-${state}${next?.gameId === cell.gameId ? " is-next" : ""}`}
              style={`grid-row:${cell.row + 1};grid-column:${cell.col + 1}`} title={`${cell.name} ${cell.current}/${cell.target}`}>
              {skillIcon(cell.sprite) && <img src={skillIcon(cell.sprite)} alt="" />}
              {(state === "raise" || state === "over") && <b>{cell.target}</b>}
            </span>
          );
        })}
      </div>
      <p class="guide-build">{guide.buildName}</p>
    </div>
  );
}

/**
 * Stretched over the game's skill window, one square per skill icon: the skills to raise light up
 * with the level the build wants, the next one brightest. Nothing is drawn over skills that are done.
 */
export function SkillAlignedElement({ locked }: { locked: boolean }) {
  const t = useTranslator();
  const guide = buildGuideState.value;
  const tree = guide ? currentTree(guide) : undefined;
  const rows = tree?.rows ?? 6;
  const cols = tree?.cols ?? 7;
  const next = guide?.skills.next[0];
  return (
    <div class={`aligned-grid${locked ? "" : " is-editing"}`} style={`--cols:${cols};--rows:${rows}`}>
      {!locked && Array.from({ length: rows * cols }, (_, index) => <span key={`guide-${index}`} class="aligned-guide-cell" style={`grid-row:${Math.floor(index / cols) + 1};grid-column:${index % cols + 1}`} />)}
      {/* While lining up, each square names its skill, to match the game's window. */}
      {!locked && tree?.cells.map((cell) => (
        <span key={`name-${cell.gameId}`} class="aligned-label" style={`grid-row:${cell.row + 1};grid-column:${cell.col + 1}`}>{cell.name}</span>
      ))}
      {guide && (guide.skills.trees.length > 1) && <span class="aligned-tab">{t("overlay.buildGuide.openTab", { tab: tree?.className ?? "" })}</span>}
      {tree?.cells.map((cell) => {
        const state = cellState(cell);
        if (state !== "raise" && state !== "over") return null;
        return (
          <span key={cell.gameId} class={`aligned-skill is-${state}${next?.gameId === cell.gameId ? " is-next" : ""}`}
            style={`grid-row:${cell.row + 1};grid-column:${cell.col + 1}`}>
            <span class="aligned-badge">{cell.current}→<b>{cell.target}</b></span>
          </span>
        );
      })}
      {!locked && <p class="aligned-hint">{t("overlay.buildGuide.alignSkills")}</p>}
    </div>
  );
}

/** What the build still needs, each with where it best drops. */
export function FarmGuideElement() {
  const t = useTranslator();
  const guide = buildGuideState.value;
  if (!guide) return <NoBuild title={t("overlay.buildGuide.farm")} />;
  const { items } = guide.farm;
  return (
    <div class="element-content guide-content">
      <div class="guide-head">
        <h2 class="element-title">{t("overlay.buildGuide.farm")}</h2>
        <span class="guide-points"><b>{items.length}</b>{t("overlay.buildGuide.missing")}</span>
      </div>
      {items.length === 0
        ? <p class="guide-waiting">{t("overlay.buildGuide.farmDone")}</p>
        : (
          <div class="guide-farm">
            {items.map((item) => (
              <div key={`${item.kind}:${item.itemId}`} class="guide-farm-row">
                <span class="guide-farm-icon">{item.icon && <img src={item.icon} alt="" />}</span>
                <span class="guide-farm-name">{item.name}{item.need > 1 && <b> {item.have}/{item.need}</b>}</span>
                <span class="guide-farm-where">
                  {item.chance !== undefined
                    ? <><b class={item.boss ? "is-boss" : undefined}>{percent(item.chance)}</b> {item.monster} · {item.map ?? "—"}</>
                    : item.craftedAt ? <><b class="is-craft">{t("overlay.buildGuide.craft")}</b> {item.craftedAt}</> : t("overlay.buildGuide.noSource")}
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

/** Stretched over the game's world map, one square per map: where the missing items drop. */
export function MapAlignedElement({ locked }: { locked: boolean }) {
  const t = useTranslator();
  const guide = buildGuideState.value;
  const grid = guide?.farm.grid ?? { rows: 10, cols: 11 };
  return (
    <div class={`aligned-grid is-map${locked ? "" : " is-editing"}`} style={`--cols:${grid.cols};--rows:${grid.rows}`}>
      {!locked && Array.from({ length: grid.rows * grid.cols }, (_, index) => <span key={`guide-${index}`} class="aligned-guide-cell" style={`grid-row:${Math.floor(index / grid.cols) + 1};grid-column:${index % grid.cols + 1}`} />)}
      {!locked && guide?.farm.tiles.map((tile) => (
        <span key={`name-${tile.row}-${tile.col}`} class="aligned-label" style={`grid-row:${tile.row};grid-column:${tile.col}`}>{tile.name}</span>
      ))}
      {guide?.farm.squares.map((square) => (
        <span key={`${square.row}-${square.col}`} class="aligned-square" style={`grid-row:${square.row};grid-column:${square.col}`}
          title={`${square.name} · Lv ${square.minLevel}-${square.maxLevel}`}>
          <b>{square.items}</b>
        </span>
      ))}
      {!locked && <p class="aligned-hint">{t("overlay.buildGuide.alignMap")}</p>}
    </div>
  );
}
