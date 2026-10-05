import { render } from "preact";
import { useTranslator } from "@svoverlay/i18n/browser";
import { DragGhost, OverlayElement } from "./element-frame.tsx";
import { ElementInspectorPanel } from "./inspector-panel.tsx";
import {
  chromeState,
  gridEnabled,
  selectedElementId,
} from "./store.ts";
import { setLocked, startOverlayTransport } from "./transport.ts";
import { BossTimersOverlayElement } from "./tiles/boss-timers.tsx";
import { ClockElement } from "./tiles/clock.tsx";
import { TimerElement } from "./tiles/timer.tsx";
import { DamageTakenElement, DpsDetailsElement, ItemCounterElement, KillCounterElement, SummonsElement } from "./tiles/details.tsx";
import { GearRatingElement } from "./tiles/gear-rating.tsx";
import { BossMeterElement } from "./tiles/boss-meter.tsx";
import { ArtifactPickupElement, GearPickupElement, LootAlertElement, TargetDropElement } from "./tiles/gear-pickup.tsx";
import {
  CharacterResourceElement,
  GoldTrackerElement,
  WeightOverlayElement,
  XpChartElement,
  XpTrackerElement,
} from "./tiles/character.tsx";
import { DpsChartElement, PartyRankingElement, PersonalDpsElement } from "./tiles/meter.tsx";
import { LootToastElement, MinimapElement } from "./tiles/minimap.tsx";
import { StatusOverlayElement } from "./tiles/status.tsx";

function App() {
  const t = useTranslator();
  const next = chromeState.value;
  if (!next) return <main class="overlay-root" />;
  return (
    <main class={next.locked ? "overlay-root" : "overlay-root editing"}>
      {!next.locked && <div class="edit-scrim" onPointerDown={() => { selectedElementId.value = undefined; }} />}
      {!next.locked && gridEnabled.value && <div class="grid-overlay" aria-hidden="true" />}
      {!next.locked && (
        <div class="edit-controls">
          <p class="edit-hint">
            {t(
              next.displayLayout.length > 1 ? "overlay.edit.hintMultiDisplay" : "overlay.edit.hint",
              { shortcut: next.shortcuts.toggleLock },
            )}
          </p>
          <div class="edit-buttons">
            <button
              class={gridEnabled.value ? "lock-pill grid-pill active" : "lock-pill grid-pill"}
              type="button"
              onClick={() => { gridEnabled.value = !gridEnabled.value; }}
            >
              {t(gridEnabled.value ? "overlay.edit.gridOn" : "overlay.edit.gridOff")}
            </button>
            <button class="lock-pill" type="button" onClick={() => void setLocked(true)}>{t("overlay.edit.lock")}</button>
          </div>
        </div>
      )}
      {!next.locked && <ElementInspectorPanel selectedId={selectedElementId.value} />}
      <OverlayElement id="dpsChart" locked={next.locked}>
        <DpsChartElement />
      </OverlayElement>
      <OverlayElement id="personalDps" locked={next.locked}>
        <PersonalDpsElement />
      </OverlayElement>
      <OverlayElement id="health" locked={next.locked}>
        <CharacterResourceElement kind="health" />
      </OverlayElement>
      <OverlayElement id="mana" locked={next.locked}>
        <CharacterResourceElement kind="mana" />
      </OverlayElement>
      <OverlayElement id="characterXp" locked={next.locked}>
        <CharacterResourceElement kind="character-xp" />
      </OverlayElement>
      <OverlayElement id="jobXp" locked={next.locked}>
        <CharacterResourceElement kind="job-xp" />
      </OverlayElement>
      <WeightOverlayElement locked={next.locked} />
      <OverlayElement id="xpTracker" locked={next.locked}>
        <XpTrackerElement locked={next.locked} />
      </OverlayElement>
      <OverlayElement id="goldTracker" locked={next.locked}>
        <GoldTrackerElement locked={next.locked} />
      </OverlayElement>
      <OverlayElement id="xpChart" locked={next.locked}>
        <XpChartElement />
      </OverlayElement>
      <OverlayElement id="partyRanking" locked={next.locked}>
        <PartyRankingElement />
      </OverlayElement>
      <StatusOverlayElement id="buffs" locked={next.locked} category="buffs" flashExpiring />
      {/* Debuffs deliberately do not flash: one running out is good news. */}
      <StatusOverlayElement id="debuffs" locked={next.locked} category="debuffs" />
      <StatusOverlayElement id="toggles" locked={next.locked} category="toggles" />
      {next.minimapEnabled && <OverlayElement id="minimap" locked={next.locked}>
        <MinimapElement />
      </OverlayElement>}
      <OverlayElement id="lootToast" locked={next.locked}>
        <LootToastElement />
      </OverlayElement>
      <BossTimersOverlayElement locked={next.locked} />
      <OverlayElement id="clock" locked={next.locked}>
        <ClockElement />
      </OverlayElement>
      <OverlayElement id="timer" locked={next.locked}>
        <TimerElement />
      </OverlayElement>
      <OverlayElement id="damageTaken" locked={next.locked}>
        <DamageTakenElement />
      </OverlayElement>
      <OverlayElement id="gearRating" locked={next.locked}>
        <GearRatingElement />
      </OverlayElement>
      <OverlayElement id="bossMeter" locked={next.locked}>
        <BossMeterElement />
      </OverlayElement>
      <OverlayElement id="summons" locked={next.locked}>
        <SummonsElement />
      </OverlayElement>
      <OverlayElement id="itemCounter" locked={next.locked}>
        <ItemCounterElement />
      </OverlayElement>
      <OverlayElement id="killCounter" locked={next.locked}>
        <KillCounterElement />
      </OverlayElement>
      <OverlayElement id="dpsDetails" locked={next.locked}>
        <DpsDetailsElement />
      </OverlayElement>
      <OverlayElement id="gearPickup" locked={next.locked}>
        <GearPickupElement />
      </OverlayElement>
      <OverlayElement id="lootAlert" locked={next.locked}>
        <LootAlertElement />
      </OverlayElement>
      <OverlayElement id="targetDrop" locked={next.locked}>
        <TargetDropElement />
      </OverlayElement>
      <OverlayElement id="artifactPickup" locked={next.locked}>
        <ArtifactPickupElement />
      </OverlayElement>
      {!next.locked && <DragGhost surface={next.surface} />}
    </main>
  );
}

startOverlayTransport();
render(<App />, document.getElementById("root")!);
