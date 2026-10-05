import { computed } from "@preact/signals";
import { isAlwaysShownLoot } from "@svoverlay/contracts/loot";
import { useTranslator } from "@svoverlay/i18n/browser";
import type { OverlayLootToastEvent, OverlayMinimapLootDrop } from "../../app-types.ts";
import { rarityColor, rarityLabelKey } from "../../rarity.ts";
import { lootToasts, minimapState } from "../store.ts";
import { GravestoneIcon } from "../icons.tsx";

const DEFAULT_RADAR_WORLD_RADIUS = 215;
const RADAR_RING_COUNT = 3;

interface RadarDot extends OverlayMinimapLootDrop {
  fx: number;
  fy: number;
}

const minimapDots = computed<RadarDot[]>(() => {
  const state = minimapState.value;
  const player = state?.player;
  if (!player) return [];
  const radius = state.range ?? DEFAULT_RADAR_WORLD_RADIUS;
  return state.loot
    .filter((drop) => isAlwaysShownLoot(drop.displayName)
      || ((drop.rarity ?? 0) >= state.rarityFilter && (drop.lootChance ?? 0) <= state.lootChanceFilter))
    .flatMap((drop) => {
      const dx = drop.x - player.x;
      // The game's world-space x axis maps to the radar's vertical (N/S) axis (inverted), and z maps to horizontal (E/W, inverted).
      const dz = drop.z - player.z;
      const fx = -dz / radius;
      const fy = -dx / radius;
      if (Math.hypot(fx, fy) > 1) return [];
      return [{ ...drop, fx, fy }];
    });
});

interface RadarGravestone {
  objectId: number;
  bossName: string;
  fx: number;
  fy: number;
  distant: boolean;
}

/** Gravestones stay on the radar at any range: one past the edge is pinned to the rim as a bearing. */
const minimapGravestones = computed<RadarGravestone[]>(() => {
  const state = minimapState.value;
  const player = state?.player;
  if (!player) return [];
  const radius = state.range ?? DEFAULT_RADAR_WORLD_RADIUS;
  return (state.gravestones ?? []).map((gravestone) => {
    const fx = -(gravestone.z - player.z) / radius;
    const fy = -(gravestone.x - player.x) / radius;
    const distance = Math.hypot(fx, fy);
    const scale = distance > 1 ? 1 / distance : 1;
    return { objectId: gravestone.objectId, bossName: gravestone.bossName, fx: fx * scale, fy: fy * scale, distant: distance > 1 };
  });
});

export function MinimapElement() {
  const t = useTranslator();
  const state = minimapState.value;
  return (
    <div class="minimap-radar">
      <MinimapRangeRings />
      <div class="minimap-crosshair horizontal" />
      <div class="minimap-crosshair vertical" />
      <span class="minimap-compass north">N</span>
      <span class="minimap-compass south">S</span>
      <span class="minimap-compass east">E</span>
      <span class="minimap-compass west">W</span>
      {state?.player ? (
        <>
          <span
            class="minimap-player"
            style={state.player.heading === undefined
              ? undefined
              : { transform: `translate(-50%, -50%) rotate(${state.player.heading * (180 / Math.PI) - 90}deg)` }}
          />
          {minimapDots.value.map((dot) => <MinimapLootDot key={dot.objectId} dot={dot} />)}
          {minimapGravestones.value.map((gravestone) => (
            <span
              key={gravestone.objectId}
              class={`minimap-gravestone${gravestone.distant ? " is-distant" : ""}`}
              style={{ left: `calc(50% + ${gravestone.fx * 50}%)`, top: `calc(50% + ${gravestone.fy * 50}%)` }}
              title={t("overlay.minimap.gravestone", { boss: gravestone.bossName })}
            ><GravestoneIcon /></span>
          ))}
        </>
      ) : <span class="minimap-empty">{t("overlay.minimap.waiting")}</span>}
    </div>
  );
}

function MinimapRangeRings() {
  return <>{Array.from({ length: RADAR_RING_COUNT }, (_, index) => {
    const percent = ((index + 1) / RADAR_RING_COUNT) * 100;
    return <span key={index} class="minimap-ring" style={{ width: `${percent}%`, height: `${percent}%`, left: "50%", top: "50%" }} />;
  })}</>;
}

function MinimapLootDot({ dot }: { dot: RadarDot }) {
  const t = useTranslator();
  const color = rarityColor(dot.rarity);
  return (
    <span
      class="minimap-dot"
      style={{
        left: `calc(50% + ${dot.fx * 50}%)`,
        top: `calc(50% + ${dot.fy * 50}%)`,
        backgroundColor: color,
        "--dot-color": color,
      }}
      title={`${dot.displayName ?? t("overlay.loot.fallbackName")} (${t(rarityLabelKey(dot.rarity))}${dot.lootChance !== undefined ? `, ${dot.lootChance.toFixed(2)}%` : ""})`}
    />
  );
}

export function LootToastElement() {
  const cards = lootToasts.value;
  return (
    <div class="loot-toast-stack">
      {cards.map((card) => <LootToastCard key={card.id} event={card.event} />)}
    </div>
  );
}

function LootToastCard({ event }: { event: OverlayLootToastEvent }) {
  const t = useTranslator();
  const color = rarityColor(event.rarity);
  return (
    <div class="loot-toast-card" style={{ "--rarity-color": color }}>
      <span class="loot-toast-name">{event.displayName ?? t("overlay.loot.fallbackName")}</span>
      <span class="loot-toast-rarity">{t(rarityLabelKey(event.rarity))}</span>
    </div>
  );
}
