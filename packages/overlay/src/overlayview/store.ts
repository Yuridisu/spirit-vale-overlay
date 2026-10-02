import { batch, computed, signal, type Signal } from "@preact/signals";
import type { FishNetActiveStatus } from "@kar-mi/spirit-vale-tools-combat";

import type {
  BossTimerState,
  KeybindAction,
  OverlayCharacterState,
  OverlayControlState,
  OverlayDisplayPlacement,
  OverlayDragPreview,
  OverlayElementId,
  OverlayElementSettings,
  OverlayBossFightState,
  OverlayDamageTakenState,
  OverlayGearPickupEvent,
  OverlayGearRatingState,
  OverlayItemCounterState,
  OverlayKillState,
  OverlayTimerState,
  OverlayLootToastEvent,
  OverlayMeterState,
  OverlayMinimapState,
  OverlayStatusState,
  PersonalDpsMode,
  StatType,
} from "../app-types.ts";
import { OVERLAY_ELEMENT_IDS } from "../app-types.ts";
import { weightWarnLevel } from "../weight-warning.ts";

const LOOT_TOAST_LIFETIME_MS = 3_000;
const STATUS_TICK_MS = 100;
const BOSS_TICK_MS = 1_000;

export interface OverlayChrome {
  locked: boolean;
  meterStatType: StatType;
  personalDpsMode: PersonalDpsMode;
  shortcuts: Record<KeybindAction, string>;
  surface?: OverlayDisplayPlacement;
  displayLayout: OverlayDisplayPlacement[];
  minimapEnabled: boolean;
}

export interface GearPickupCardState {
  id: string;
  event: OverlayGearPickupEvent;
}

export interface LootToastCardState {
  id: string;
  event: OverlayLootToastEvent;
}

export const chromeState = signal<OverlayChrome | undefined>(undefined);
export const elementStates = Object.fromEntries(
  OVERLAY_ELEMENT_IDS.map((id) => [id, signal<OverlayElementSettings | undefined>(undefined)]),
) as Record<OverlayElementId, Signal<OverlayElementSettings | undefined>>;
export const characterState = signal<OverlayCharacterState | undefined>(undefined);
export const weightWarn = computed(() => weightWarnLevel(characterState.value?.weight));
export const statusState = signal<OverlayStatusState | undefined>(undefined);
export const statusNow = signal(Date.now());
export const bossTimerState = signal<BossTimerState | undefined>(undefined);
export const bossNow = signal(Date.now());
export const meterState = signal<OverlayMeterState | undefined>(undefined);
export const minimapState = signal<OverlayMinimapState | undefined>(undefined);
export const lootToasts = signal<LootToastCardState[]>([]);
export const gearPickups = signal<GearPickupCardState[]>([]);
export const timerState = signal<OverlayTimerState | undefined>(undefined);
export const killState = signal<OverlayKillState | undefined>(undefined);
export const bossFightState = signal<OverlayBossFightState | undefined>(undefined);
export const gearRatingState = signal<OverlayGearRatingState | undefined>(undefined);
export const damageTakenState = signal<OverlayDamageTakenState | undefined>(undefined);
export const itemCounter = signal<OverlayItemCounterState | undefined>(undefined);
export const artifactPickups = signal<GearPickupCardState[]>([]);
export const gridEnabled = signal(false);
export const selectedElementId = signal<OverlayElementId | undefined>(undefined);
export const panelPosition = signal<{ x: number; y: number } | undefined>(undefined);
export const dragPreview = signal<OverlayDragPreview | undefined>(undefined);

let statusTicker: ReturnType<typeof setInterval> | undefined;
let bossTicker: ReturnType<typeof setInterval> | undefined;
let lootToastSequence = 0;
let gearPickupSequence = 0;
/** Long enough to read a card's stats mid-fight. */
const GEAR_PICKUP_LIFETIME_MS = 15_000;
/** How long a card is guaranteed once another is waiting behind it. */
const GEAR_PICKUP_QUEUED_LIFETIME_MS = 6_000;
const MAX_QUEUED_GEAR_PICKUPS = 20;
let lastChromeJson: string | undefined;
const lastElementJson = new Map<OverlayElementId, string | undefined>();

export function applyControl(next: OverlayControlState): void {
  batch(() => {
    const chrome: OverlayChrome = {
      locked: next.locked,
      meterStatType: next.meterStatType,
      personalDpsMode: next.personalDpsMode,
      shortcuts: next.shortcuts,
      surface: next.surface,
      displayLayout: next.displayLayout,
      minimapEnabled: next.minimapEnabled,
    };
    const chromeJson = JSON.stringify(chrome);
    if (chromeJson !== lastChromeJson) {
      lastChromeJson = chromeJson;
      chromeState.value = chrome;
    }
    for (const id of OVERLAY_ELEMENT_IDS) {
      const element = next.elements[id];
      const json = element === undefined ? undefined : JSON.stringify(element);
      if (json === lastElementJson.get(id)) continue;
      lastElementJson.set(id, json);
      elementStates[id].value = element;
    }
  });
}

export function applyStatuses(next: OverlayStatusState): void {
  statusState.value = next;
  statusNow.value = Date.now();
  const counting = [next.buffs, next.debuffs, next.toggles]
    .some((statuses: readonly FishNetActiveStatus[] | undefined) => statuses?.some((status) => status.remainingMs !== undefined));
  if (counting && statusTicker === undefined) {
    statusTicker = setInterval(() => { statusNow.value = Date.now(); }, STATUS_TICK_MS);
  } else if (!counting && statusTicker !== undefined) {
    clearInterval(statusTicker);
    statusTicker = undefined;
  }
}

export function applyBossTimers(next: BossTimerState): void {
  bossTimerState.value = next;
  bossNow.value = Date.now();
  if (next.timers.length > 0 && bossTicker === undefined) {
    bossTicker = setInterval(() => { bossNow.value = Date.now(); }, BOSS_TICK_MS);
  } else if (next.timers.length === 0 && bossTicker !== undefined) {
    clearInterval(bossTicker);
    bossTicker = undefined;
  }
}

/**
 * Shows pickups one card at a time. A lone card stays its full lifetime; once another is waiting,
 * the one on screen only keeps its shorter guaranteed time before the next takes over.
 */
function createPickupQueue(cards: Signal<GearPickupCardState[]>): (event: OverlayGearPickupEvent) => void {
  const queued: GearPickupCardState[] = [];
  let shownAtMs = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const scheduleAdvance = (delayMs: number): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const next = queued.shift();
      if (next) show(next);
      else cards.value = [];
    }, Math.max(0, delayMs));
  };
  const show = (card: GearPickupCardState): void => {
    cards.value = [card];
    shownAtMs = Date.now();
    scheduleAdvance(queued.length > 0 ? GEAR_PICKUP_QUEUED_LIFETIME_MS : GEAR_PICKUP_LIFETIME_MS);
  };

  return (event) => {
    const card = { id: `${Date.now()}-${gearPickupSequence++}`, event };
    if (cards.value.length === 0) {
      show(card);
      return;
    }
    if (queued.length >= MAX_QUEUED_GEAR_PICKUPS) queued.shift();
    queued.push(card);
    scheduleAdvance(GEAR_PICKUP_QUEUED_LIFETIME_MS - (Date.now() - shownAtMs));
  };
}

export const pushGearPickup = createPickupQueue(gearPickups);
export const pushArtifactPickup = createPickupQueue(artifactPickups);

export function pushLootToast(event: OverlayLootToastEvent): void {
  const id = `${Date.now()}-${lootToastSequence++}`;
  lootToasts.value = [...lootToasts.value, { id, event }];
  setTimeout(() => {
    lootToasts.value = lootToasts.value.filter((card) => card.id !== id);
  }, LOOT_TOAST_LIFETIME_MS);
}
