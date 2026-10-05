import { useState } from "preact/hooks";
import { useTranslator } from "@svoverlay/i18n/browser";
import type { OverlayGearPickupEvent } from "../../app-types.ts";
import { artifactPickups, gearPickups, lootAlerts, targetDrops } from "../store.ts";
import type { GearPickupCardState } from "../store.ts";

/** The card for the equipment the player just picked up; several pickups take turns, one at a time. */
export function GearPickupElement() {
  return <PickupCards cards={gearPickups.value} kind="gear" />;
}

/** Artifacts get their own element, so they can sit apart from equipment and be told apart at a glance. */
export function ArtifactPickupElement() {
  return <PickupCards cards={artifactPickups.value} kind="artifact" />;
}

/** A drop the player set as a target, announced under a banner so it cannot be taken for an ordinary pickup. */
export function TargetDropElement() {
  const t = useTranslator();
  return (
    <div class="gear-pickup-stack pickup-target">
      {targetDrops.value.map((card) => (
        <div class="target-drop" key={card.id}>
          <div class="target-drop-banner">{t("overlay.targetDrop.banner")}</div>
          <GearPickupCard event={card.event} />
        </div>
      ))}
    </div>
  );
}

/**
 * An item that matched one of the Companion's loot rules, under a banner in the rule's own colour
 * and with its tag, the way Vale Companion shows it over the game.
 */
export function LootAlertElement() {
  return (
    <div class="gear-pickup-stack pickup-loot-alert">
      {lootAlerts.value.map((card) => {
        const color = card.event.rule?.color ?? "rgb(255, 213, 74)";
        return (
          <div class="target-drop loot-alert" key={card.id} style={`--rule-color:${color};--rule-ink:${inkOn(color)}`}>
            <div class="target-drop-banner">{card.event.rule?.tag || card.event.displayName}</div>
            <GearPickupCard event={card.event} />
          </div>
        );
      })}
    </div>
  );
}

/** Black or white, whichever reads better on a `#rrggbb` background; white when the colour is unreadable. */
function inkOn(color: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return "white";
  const value = Number.parseInt(match[1]!, 16);
  const luminance = (0.299 * (value >> 16) + 0.587 * ((value >> 8) & 0xff) + 0.114 * (value & 0xff)) / 255;
  return luminance > 0.6 ? "#14100a" : "white";
}

function PickupCards({ cards, kind }: { cards: readonly GearPickupCardState[]; kind: "gear" | "artifact" }) {
  return (
    <div class={`gear-pickup-stack pickup-${kind}`}>
      {cards.map((card) => <GearPickupCard key={card.id} event={card.event} />)}
    </div>
  );
}

function GearPickupCard({ event }: { event: OverlayGearPickupEvent }) {
  const t = useTranslator();
  const [iconMissing, setIconMissing] = useState(false);
  return (
    <div class="gear-pickup-card">
      <div class="gear-pickup-header">
        {event.iconUrl !== undefined && !iconMissing && <img class="gear-pickup-icon" src={event.iconUrl} alt="" aria-hidden="true" onError={() => setIconMissing(true)} />}
        <div class="gear-pickup-title">
          <span class="gear-pickup-name">{event.displayName}</span>
          {event.slot !== undefined && <span class="gear-pickup-slot">{event.slot}</span>}
        </div>
        {event.refine > 0 && <span class="gear-pickup-refine">+{event.refine}</span>}
      </div>
      {event.count !== undefined
        ? <p class="gear-pickup-count">{t("overlay.targetDrop.count", { count: event.count })}</p>
        : event.stats.length === 0
        ? <p class="gear-pickup-empty">{t("overlay.gearPickup.noStats")}</p>
        : (
          <div class="gear-pickup-stats">
            {event.stats.map((stat, index) => (
              <div class="gear-pickup-stat" key={index}>
                <span class="gear-pickup-stat-label">
                  {stat.qualifier ? `${stat.label} (${stat.qualifier})` : stat.label}
                </span>
                <span class="gear-pickup-stat-value">
                  {stat.value !== undefined && <strong>{stat.value}</strong>}
                  <span class="gear-pickup-roll">{t("overlay.gearPickup.roll", { roll: stat.roll })}</span>
                </span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
