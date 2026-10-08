import path from "node:path";
import { LiveCombatService, normalizeName } from "@kar-mi/spirit-vale-tools-combat";
import type { CharacterViewState } from "@kar-mi/spirit-vale-tools-character";
import type { CombatEncounterRecord, DpsLogBatch } from "@kar-mi/spirit-vale-tools-combat";
import { localized, sameLocalizedText, type LocalizedText } from "@svoverlay/i18n/messages";
import type { SpiritValeLocation } from "@svoverlay/desktop-platform/location";

import type { DpsAppState, DpsAppStatus } from "../app-types.ts";
import { detectedPersonalName } from "../personal-character.ts";
import { locationFromLogData } from "../zone-log.ts";
import { createLiveLogSource } from "./live-log-source.ts";
import { rescaleSubstats } from "@kar-mi/spirit-vale-tools-character";
import { resolveFishNetItem } from "@kar-mi/spirit-vale-tools-items";
import { resolveFishNetSkill } from "@kar-mi/spirit-vale-tools-skills";
import { BattleAnalysis, type BattleEvent } from "../battle-analysis.ts";

const POLL_MS = 1_000;
const METER_TICK_MS = 1_000;
const TIMELINE_POINTS = 720;

export interface LiveCombatState {
  status: DpsAppStatus;
  statusDetail: LocalizedText;
  personalName: string;
  personalActorId?: number;
  location?: SpiritValeLocation;
  logPath?: string;
  snapshots: Pick<DpsAppState, "snapshot" | "tankedSnapshot" | "healSnapshot">;
}

/** The stat sheet's attack totals, the server's own value where it was sent. */
function attackTotals(state: CharacterViewState): { magic?: number; physical?: number } {
  const value = (id: string) => {
    const stat = state.stats.find((entry) => entry.id === id);
    const n = stat?.record ?? stat?.value;
    return n !== undefined && Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const melee = value("melee-attack");
  const ranged = value("ranged-attack");
  const physical = melee === undefined && ranged === undefined ? undefined : Math.max(melee ?? 0, ranged ?? 0);
  return { ...(value("magic-attack") === undefined ? {} : { magic: value("magic-attack") }), ...(physical === undefined ? {} : { physical }) };
}

export class LiveCombatController {
  private readonly overridePath = process.env.SPIRIT_VALE_COMBAT_LOG;
  private readonly source;
  private personalName: string;
  private manualPersonalActorId: number | undefined;
  private meter: LiveCombatService;
  private status: DpsAppStatus = "waiting";
  private statusDetail: LocalizedText;
  private timer?: ReturnType<typeof setTimeout>;
  private lastPublishMs = Number.NEGATIVE_INFINITY;
  private shuttingDown = false;
  private lastEventObservedAtMs?: number;
  private lastEventWallMs?: number;
  private logPath?: string;
  private location?: SpiritValeLocation;
  /**
   * The player's actor ids, learned from identities that carry the personal name. The meter finds
   * the player by name too and only keeps an id when one is picked by hand, so Battle Analysis
   * keeps its own; an id is dropped as soon as the game hands it to someone else.
   */
  private readonly ownActorIds = new Set<number>();
  /** Player and monster names by actor id, for who hit the player and whom they healed. */
  private readonly names = new Map<number, string>();
  /** Battle Analysis: the player's own damage by source, by item and per gear set. Kept across log sessions. */
  readonly battle = new BattleAnalysis({
    resolveItem: (type, id) => resolveFishNetItem(type, id),
    resolveSkill: (id) => resolveFishNetSkill(id),
    rescale: (snapshot) => rescaleSubstats(snapshot),
    nameOf: (actorId) => this.names.get(actorId),
  });

  constructor(logDirectory: string, initialCharacterState: CharacterViewState, private readonly publish: () => void) {
    this.personalName = detectedPersonalName(initialCharacterState);
    this.battle.setCharacter(initialCharacterState.snapshot);
    this.battle.setAttack(attackTotals(initialCharacterState));
    this.meter = this.createMeter();
    this.source = createLiveLogSource(logDirectory, this.overridePath, POLL_MS);
    this.statusDetail = this.overridePath
      ? localized("combat.status.lookingForFile", { file: path.basename(this.overridePath) })
      : localized("combat.status.lookingForSession");
  }

  start(): void {
    void this.follow();
  }

  state(): LiveCombatState {
    return {
      status: this.status,
      statusDetail: this.statusDetail,
      personalName: this.personalName,
      ...(this.meter.getPersonalActorId() === undefined ? {} : { personalActorId: this.meter.getPersonalActorId() }),
      ...(this.location === undefined ? {} : { location: this.location }),
      ...(this.logPath === undefined ? {} : { logPath: this.logPath }),
      snapshots: this.snapshots(),
    };
  }

  snapshots(): LiveCombatState["snapshots"] {
    const record = this.latestRecord();
    return record ? { snapshot: record.dps, tankedSnapshot: record.tps.detail, healSnapshot: record.hps.detail } : {};
  }

  setPersonalActor(actorId: number | undefined): void {
    this.manualPersonalActorId = actorId;
    this.meter.setPersonalActorId(actorId);
    this.publish();
  }

  syncCharacter(characterState: CharacterViewState): void {
    this.battle.setCharacter(characterState.snapshot);
    this.battle.setAttack(attackTotals(characterState));
    const nextName = detectedPersonalName(characterState);
    if (nextName === this.personalName) return;
    this.personalName = nextName;
    this.ownActorIds.clear();
    this.meter.setPersonalName(nextName);
    if (this.manualPersonalActorId !== undefined) {
      this.manualPersonalActorId = undefined;
      this.meter.setPersonalActorId(undefined);
    }
    this.publish();
  }

  reset(): void {
    this.meter = this.createMeter();
    this.lastEventObservedAtMs = undefined;
    this.lastEventWallMs = undefined;
    this.location = undefined;
  }

  close(): void {
    this.shuttingDown = true;
    this.source.close();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async follow(): Promise<void> {
    while (!this.shuttingDown) {
      let batch: DpsLogBatch;
      try {
        batch = await this.source.next();
      } catch {
        this.updateStatus("error", localized("combat.status.readFailed", { file: path.basename(this.overridePath ?? "combat.jsonl") }));
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        continue;
      }
      if (this.shuttingDown) return;
      this.applyBatch(batch);
    }
  }

  private applyBatch(batch: DpsLogBatch): void {
    if (!batch.changed) return;
    this.logPath = batch.path ?? this.overridePath ?? this.logPath;
    if (batch.reset) this.reset();
    let batchLastObservedAtMs: number | undefined;
    for (const { event, observedAtMs } of batch.events) {
      if (event.kind === "activation") {
        const location = locationFromLogData(event as unknown as Record<string, unknown>);
        if (location !== undefined) this.location = location;
      }
      if (event.kind === "actorIdentity") {
        this.meter.consumeIdentity(event, observedAtMs);
        this.noteOwnIdentity(event as unknown as { actorId?: number; displayName?: string });
      } else {
        this.meter.consumeCombat(event, observedAtMs);
        this.noteBattle(event as unknown as BattleEvent, observedAtMs);
      }
      batchLastObservedAtMs = Math.max(batchLastObservedAtMs ?? observedAtMs, observedAtMs);
    }
    if (batchLastObservedAtMs !== undefined) {
      this.lastEventObservedAtMs = batchLastObservedAtMs;
      this.lastEventWallMs = Date.now();
    }
    const nowMs = this.relativeNowMs();
    if (nowMs !== undefined) this.meter.advance(nowMs);
    const fileName = path.basename(batch.path ?? this.overridePath ?? "combat.jsonl");
    const statusChanged = batch.missing
      ? this.updateStatus("waiting", localized("combat.status.waitingForFile", { file: fileName }))
      : batch.invalidLines > 0
        ? this.updateStatus("ready", localized("combat.status.readingSkipped", { file: fileName }))
        : batch.events.length > 0
          ? this.updateStatus("capturing", localized("combat.status.reading", { file: fileName }))
          : this.updateStatus(this.latestRecord() ? "ready" : "waiting", localized("combat.status.watching", { file: fileName }));
    if (!statusChanged && (batch.events.length > 0 || batch.reset)) this.publishProgress();
    this.scheduleTick();
  }

  /** The player's own casts, and hits on enemies (a clone's hits carry the player's id). */
  private noteOwnIdentity(identity: { actorId?: number; displayName?: string }): void {
    if (identity.actorId === undefined || !identity.displayName) return;
    this.names.set(identity.actorId, identity.displayName);
    const mine = Boolean(this.personalName) && normalizeName(identity.displayName) === normalizeName(this.personalName);
    if (mine) this.ownActorIds.add(identity.actorId);
    else this.ownActorIds.delete(identity.actorId);
  }

  private isOwnActor(actorId: number | undefined): boolean {
    if (actorId === undefined) return false;
    const picked = this.meter.getPersonalActorId();
    return picked !== undefined ? actorId === picked : this.ownActorIds.has(actorId);
  }

  /** The player's casts and hits, the hits aimed at them, and the heals and shields they cast or got. */
  private noteBattle(event: BattleEvent & { operation?: string; displayName?: string }, observedAtMs: number): void {
    if (event.kind === "monsterIdentity") {
      if (event.operation === "upsert" && event.actorId !== undefined && event.displayName) this.names.set(event.actorId, event.displayName);
      return;
    }
    const byMe = this.isOwnActor(event.actorId);
    const toMe = this.isOwnActor(event.targetId);
    if (event.kind === "heal" || event.kind === "shield") {
      if (byMe || toMe) this.battle.noteRecovery(event, observedAtMs, { byMe, toMe });
      return;
    }
    if (event.kind === "damage" && toMe && !byMe) {
      this.battle.noteTaken(event, observedAtMs);
      return;
    }
    if (!byMe) return;
    if (event.kind === "activation") {
      this.battle.noteActivation(event);
      return;
    }
    const hit = event.kind === "damage" || (event.kind === "death" && event.duplicatesDamageEvent === false);
    if (!hit || event.team !== 0 || toMe) return;
    this.battle.noteDamage({ ...event, kind: "damage" }, observedAtMs);
  }

  private tick = (): void => {
    this.timer = undefined;
    if (this.shuttingDown) return;
    const nowMs = this.relativeNowMs();
    if (nowMs !== undefined) this.meter.advance(nowMs);
    this.lastPublishMs = Date.now();
    this.publish();
    this.scheduleTick();
  };

  private publishProgress(): void {
    const now = Date.now();
    if (now - this.lastPublishMs < METER_TICK_MS) return;
    this.lastPublishMs = now;
    this.publish();
  }

  private scheduleTick(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.shuttingDown || this.meter.getState(this.relativeNowMs()).current === undefined) return;
    this.timer = setTimeout(this.tick, METER_TICK_MS);
    this.timer.unref?.();
  }

  private relativeNowMs(): number | undefined {
    if (this.lastEventObservedAtMs === undefined || this.lastEventWallMs === undefined) return undefined;
    return this.lastEventObservedAtMs + (Date.now() - this.lastEventWallMs);
  }

  private createMeter(): LiveCombatService {
    return new LiveCombatService({
      personalName: this.personalName,
      timelinePoints: TIMELINE_POINTS,
      ...(this.manualPersonalActorId === undefined ? {} : { personalActorId: this.manualPersonalActorId }),
    });
  }

  private latestRecord(): CombatEncounterRecord | undefined {
    const state = this.meter.getState(this.relativeNowMs());
    return state.current ?? state.latestFinished;
  }

  private updateStatus(status: DpsAppStatus, detail: LocalizedText): boolean {
    if (this.status === status && sameLocalizedText(this.statusDetail, detail)) return false;
    this.status = status;
    this.statusDetail = detail;
    this.publish();
    return true;
  }
}
