import { useTranslator } from "@svoverlay/i18n/browser";
import type { OverlayGearPickupEvent } from "../../app-types.ts";
import { gearPickups } from "../store.ts";

/** Cards for equipment the player just picked up, newest at the bottom, each fading out on its own. */
export function GearPickupElement() {
  const cards = gearPickups.value;
  return (
    <div class="gear-pickup-stack">
      {cards.map((card) => <GearPickupCard key={card.id} event={card.event} />)}
    </div>
  );
}

function GearPickupCard({ event }: { event: OverlayGearPickupEvent }) {
  const t = useTranslator();
  return (
    <div class="gear-pickup-card">
      <div class="gear-pickup-header">
        <div class="gear-pickup-title">
          <span class="gear-pickup-name">{event.displayName}</span>
          {event.slot !== undefined && <span class="gear-pickup-slot">{event.slot}</span>}
        </div>
        {event.refine > 0 && <span class="gear-pickup-refine">+{event.refine}</span>}
      </div>
      {event.stats.length === 0
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
