// Adapted from Vale Companion's collector (src/backend/index.ts, AGPL-3.0-or-later,
// https://github.com/bjb2/valecompanion). Capture is owned by this app's coordinator, which feeds
// decoded packets in; everything from the loot session down is Vale Companion's own.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";

import type { DesktopSettingsUpdate, DesktopState, LootItemView, ProfileCommand } from "../shared/contracts.ts";
import { createDiagnosticLogger, formatError } from "../shared/diagnostics.ts";
import { LootSession } from "../core/loot-session.ts";
import { GoldSession } from "../core/gold-session.ts";
import { parseLootFilter } from "../core/filter/loot-dsl.ts";
import { consumeFishNetPacket } from "../core/packet-consumer.ts";
import { priceBag } from "../core/market-value.ts";
import { MarketContributor } from "../market/market-contributor.ts";
import { MarketSnapshot } from "../market/market-snapshot.ts";
import { loadJson, writeJsonAtomic } from "../market/market-storage.ts";
import { canonicalSoundName, findCustomSound, listCustomSounds, SOUND_NAMES, SOUND_WAVS } from "../sounds.ts";
import { STARTER_RULESET as starterFilter } from "../starter-ruleset.ts";

type Persisted = {
  soundsEnabled: boolean;
  soundVolume: number;
  contributionEnabled: boolean;
  filter: string;
  active: string;
  profiles: Record<string, string>;
};

export interface CompanionCaptureStatus {
  phase: DesktopState["phase"];
  detail: string;
  gameDetected: boolean;
}

export interface CompanionServiceOptions {
  /** Where settings, gold sessions, the market cache and custom sounds are kept. */
  dataDirectory: string;
  /** The built renderer: index.html, index.js, index.css, market.html, item-catalog.js, fonts, icons. */
  rendererDirectory: string;
  version: string;
  /** Plays a WAV at 0-100 volume. Returns whether it could be played. */
  playSound?: (wav: Uint8Array, volume: number) => boolean;
}

export type CompanionService = Awaited<ReturnType<typeof createCompanionService>>;

const profileNamePattern = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;
/** A custom alert is read into memory to be played; anything larger is not an alert sound. */
const MAX_CUSTOM_SOUND_BYTES = 4 * 1024 * 1024;

export async function createCompanionService(options: CompanionServiceOptions) {
  const { dataDirectory, rendererDirectory } = options;
  const logsDirectory = path.join(dataDirectory, "logs");
  const settingsPath = path.join(dataDirectory, "settings.json");
  const soundsDirectory = path.join(dataDirectory, "sounds");
  // The bundled artwork, then a folder the player can add to for items newer than the bundle.
  const iconDirectories = [path.join(rendererDirectory, "icons"), path.join(dataDirectory, "icons")];
  mkdirSync(soundsDirectory, { recursive: true });
  const diagnostics = createDiagnosticLogger("companion", path.join(logsDirectory, "companion.log"));

  function defaultSettings(): Persisted {
    return {
      // Off until asked for: the starter rules sound on many ordinary drops, and the overlay's own
      // target drops are the way to be told about the one item being hunted.
      soundsEnabled: false,
      soundVolume: 100,
      // Uploading what the market shows is the one thing here that leaves the machine, so it is opt-in.
      contributionEnabled: false,
      filter: starterFilter,
      active: "Default",
      profiles: { Default: starterFilter },
    };
  }

  function loadSettings(): Persisted {
    try {
      const raw = JSON.parse(readFileSync(settingsPath, "utf8")) as Record<string, unknown>;
      const profiles: Record<string, string> = {};
      if (raw.profiles && typeof raw.profiles === "object") {
        for (const [name, text] of Object.entries(raw.profiles)) {
          if (profileNamePattern.test(name) && typeof text === "string") profiles[name] = text;
        }
      }
      if (Object.keys(profiles).length === 0) profiles.Default = "";
      const requestedActive = typeof raw.active === "string" ? raw.active : "Default";
      const active = Object.hasOwn(profiles, requestedActive) ? requestedActive : Object.keys(profiles)[0]!;
      return {
        soundsEnabled: typeof raw.soundsEnabled === "boolean" ? raw.soundsEnabled : false,
        soundVolume: typeof raw.soundVolume === "number" && Number.isInteger(raw.soundVolume)
          && raw.soundVolume >= 0 && raw.soundVolume <= 100 ? raw.soundVolume : 100,
        contributionEnabled: typeof raw.contributionEnabled === "boolean" ? raw.contributionEnabled : false,
        filter: profiles[active]!,
        active,
        profiles,
      };
    } catch {
      return defaultSettings();
    }
  }

  function saveSettings(value: Persisted): void {
    mkdirSync(dataDirectory, { recursive: true });
    const temporary = `${settingsPath}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporary, settingsPath);
  }

  const persisted = loadSettings();
  let warning: string | undefined;

  function soundBytes(sound: string): Uint8Array | undefined {
    const requested = canonicalSoundName(sound);
    const builtin = requested?.toLowerCase();
    if (!builtin) return undefined;
    if (Object.hasOwn(SOUND_WAVS, builtin)) return SOUND_WAVS[builtin];
    const custom = findCustomSound(soundsDirectory, builtin);
    if (!custom) return undefined;
    const bytes = readFileSync(custom.path);
    return bytes.length <= MAX_CUSTOM_SOUND_BYTES ? bytes : undefined;
  }

  const session = new LootSession({
    soundsEnabled: () => persisted.soundsEnabled && persisted.soundVolume > 0,
    onSound: (sound) => {
      try {
        const bytes = soundBytes(sound);
        if (!bytes || !options.playSound) return false;
        return options.playSound(bytes, persisted.soundVolume);
      } catch (error) {
        warning = `Could not play alert sound: ${formatError(error)}`;
        return false;
      }
    },
  });
  const storageSession = new LootSession({ silent: true });
  session.setFilter(persisted.filter);
  storageSession.setFilter(persisted.filter);

  const goldStatePath = path.join(dataDirectory, "gold-sessions.json");
  const goldSession = await loadJson(
    goldStatePath,
    () => new GoldSession(),
    (value) => GoldSession.restore(value),
    (error) => diagnostics.warn("Ignored invalid gold analytics state", { error: formatError(error) }),
  );
  const marketContributor = await MarketContributor.load({
    statePath: path.join(dataDirectory, "market-contributor.json"),
    collectorVersion: options.version,
  });
  marketContributor.setEnabled(persisted.contributionEnabled);
  const marketSnapshot = await MarketSnapshot.load({ cachePath: path.join(dataDirectory, "market-snapshot.json") });
  let marketSnapshotStarted = false;

  let capture: CompanionCaptureStatus = { phase: "waiting-for-game", detail: "Waiting for Spirit Vale", gameDetected: false };
  let activeConnectionId: string | undefined;
  let packetsObserved = 0;
  let snapshotsDecoded = 0;
  let partialSnapshots = 0;
  let lastPacketAt: string | undefined;
  let bagGeneratedAt: string | null = null;
  let storageGeneratedAt: string | null = null;
  let bagCoverage = "No inventory snapshot yet";
  let goldSaveTimer: ReturnType<typeof setTimeout> | undefined;
  let goldSaveChain: Promise<void> = Promise.resolve();

  function scheduleGoldSave(): void {
    clearTimeout(goldSaveTimer);
    goldSaveTimer = setTimeout(() => {
      goldSaveTimer = undefined;
      queueGoldSave();
    }, 250);
    goldSaveTimer.unref?.();
  }

  function queueGoldSave(): void {
    const value = goldSession.persisted();
    goldSaveChain = goldSaveChain
      .then(() => writeJsonAtomic(goldStatePath, value))
      .catch((error) => {
        warning = `Gold session history could not be saved: ${formatError(error)}`;
        diagnostics.warn("Could not save gold analytics state", { error: formatError(error) });
      });
  }

  async function flushGoldSave(): Promise<void> {
    if (goldSaveTimer !== undefined) {
      clearTimeout(goldSaveTimer);
      goldSaveTimer = undefined;
    }
    queueGoldSave();
    await goldSaveChain;
  }

  /** A name is only handed to the renderer when its file exists, so a missing icon falls back to initials. */
  let knownIcons: Set<string> | undefined;
  function availableIcons(): Set<string> {
    if (knownIcons) return knownIcons;
    knownIcons = new Set();
    for (const directory of iconDirectories) {
      try {
        for (const name of readdirSync(directory)) knownIcons.add(name);
      } catch { /* The folder is optional. */ }
    }
    return knownIcons;
  }
  function withKnownIcons(items: LootItemView[]): LootItemView[] {
    const icons = availableIcons();
    return items.map((item) => item.icon !== null && !icons.has(item.icon) ? { ...item, icon: null } : item);
  }

  function consumePacket(packet: CapturedFishNetPacket): void {
    packetsObserved++;
    lastPacketAt = new Date().toISOString();
    marketContributor.consume(packet);
    if (goldSession.consumePacket(packet)) scheduleGoldSave();
    const result = consumeFishNetPacket(packet);
    if (result.storage) {
      storageSession.consumeInventory(result.storage);
      storageGeneratedAt = new Date().toISOString();
    }
    if (!result.snapshot && !result.inventory) return;
    snapshotsDecoded++;
    if (result.snapshot?.partial) partialSnapshots++;
    if (result.snapshot) {
      if (result.snapshot.inventory) {
        bagGeneratedAt = new Date().toISOString();
        bagCoverage = result.snapshot.partial
          ? "Complete inventory; partial character tail"
          : "Complete inventory snapshot";
      }
      if (goldSession.consumeSnapshot(result.snapshot)) scheduleGoldSave();
      session.consume(result.snapshot, result.snapshotMode === "rebaseline");
    } else {
      session.consumeInventory(result.inventory!, false, true);
      bagGeneratedAt = new Date().toISOString();
      bagCoverage = "Complete inventory snapshot";
    }
  }

  /** A connection to a different server is a different character until its first snapshot says otherwise. */
  function connectionOpened(connectionId: string): void {
    if (activeConnectionId !== connectionId) {
      session.resetCharacter();
      storageSession.resetCharacter();
      bagGeneratedAt = null;
      storageGeneratedAt = null;
    }
    activeConnectionId = connectionId;
  }

  function connectionClosed(connectionId: string): void {
    if (activeConnectionId !== connectionId) return;
    activeConnectionId = undefined;
    bagGeneratedAt = null;
  }

  function setCaptureStatus(next: CompanionCaptureStatus): void {
    if (next.gameDetected !== capture.gameDetected) {
      goldSession.setGameActive(next.gameDetected);
      scheduleGoldSave();
    }
    capture = next;
  }

  /** The market listings are only fetched once someone has opened the window to look at them. */
  function activate(): void {
    if (marketSnapshotStarted) return;
    marketSnapshotStarted = true;
    marketSnapshot.start();
  }

  function currentState(): DesktopState {
    const price = (items: LootItemView[]) =>
      withKnownIcons(priceBag(items, (itemId, kind) => marketSnapshot.listingsFor(itemId, kind)));
    return {
      version: options.version,
      enabled: true,
      soundsEnabled: persisted.soundsEnabled,
      soundVolume: persisted.soundVolume,
      contributionEnabled: persisted.contributionEnabled,
      deviceName: null,
      linuxCaptureMode: "auto",
      phase: capture.phase,
      detail: capture.detail,
      capture: { backend: "Npcap", availability: capture.phase === "capture-unavailable" ? "missing" : "ready", detail: capture.detail },
      gameDetected: capture.gameDetected,
      packetsObserved,
      ...(lastPacketAt === undefined ? {} : { lastAttributedPacketAt: lastPacketAt }),
      automaticCaptureRestarts: 0,
      snapshotsDecoded,
      partialSnapshots,
      duplicateSnapshots: 0,
      market: marketContributor.snapshot(),
      marketPrices: marketSnapshot.view(),
      gold: goldSession.snapshot(),
      bag: price(session.bag()),
      storage: price(storageSession.bag()),
      storageGeneratedAt,
      bagGeneratedAt,
      bagCoverage,
      filter: {
        text: persisted.filter,
        path: `profiles/${persisted.active}.filter`,
        threshold: session.filter.threshold ?? 90,
        ruleCount: session.filter.rules.length,
        errors: session.filter.errors,
      },
      profiles: Object.keys(persisted.profiles)
        .sort((left, right) => left.localeCompare(right))
        .map((name) => ({ name, active: name === persisted.active })),
      history: session.history(),
      sounds: [...SOUND_NAMES, ...listCustomSounds(soundsDirectory).map((sound) => sound.name)],
      soundsDirectory,
      logsDirectory,
      ...(warning ? { warning } : {}),
    };
  }

  function errorResponse(message: string, status = 400): Response {
    return Response.json({ error: message }, { status });
  }

  function invalidFilterResponse(filter: string): Response | null {
    const parsed = parseLootFilter(filter);
    if (!parsed.errors.length) return null;
    const summary = parsed.errors
      .slice(0, 3)
      .map((error) => `line ${error.line}: ${error.message}`)
      .join("; ");
    return errorResponse(`filter has ${parsed.errors.length} parse error${parsed.errors.length === 1 ? "" : "s"}: ${summary}`, 422);
  }

  async function readText(request: Request, limit: number): Promise<string | null> {
    const body = await request.text();
    return body.length <= limit ? body : null;
  }

  function normalizedProfileName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const name = value.trim();
    return profileNamePattern.test(name) ? name : null;
  }

  function applyFilter(filter: string): void {
    persisted.filter = filter;
    session.setFilter(filter);
    storageSession.setFilter(filter);
  }

  const RENDERER_ASSETS: Readonly<Record<string, { filename: string; contentType: string }>> = {
    "/": { filename: "index.html", contentType: "text/html; charset=utf-8" },
    "/index.html": { filename: "index.html", contentType: "text/html; charset=utf-8" },
    "/market.html": { filename: "market.html", contentType: "text/html; charset=utf-8" },
    "/catalog.json": { filename: "catalog.json", contentType: "application/json; charset=utf-8" },
    "/index.js": { filename: "index.js", contentType: "text/javascript; charset=utf-8" },
    "/item-catalog.js": { filename: "item-catalog.js", contentType: "text/javascript; charset=utf-8" },
    "/index.css": { filename: "index.css", contentType: "text/css; charset=utf-8" },
  };

  async function routeRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const route = url.pathname;
    if (method === "GET") {
      const asset = RENDERER_ASSETS[route];
      if (asset) {
        const file = Bun.file(path.join(rendererDirectory, asset.filename));
        if (!await file.exists()) return errorResponse("companion renderer is missing", 500);
        return new Response(file, { headers: { "cache-control": "no-cache", "content-type": asset.contentType } });
      }
      if (route.startsWith("/fonts/")) {
        const name = decodeURIComponent(route.slice("/fonts/".length));
        if (!/^[A-Za-z0-9_.-]+\.woff2$/.test(name)) return errorResponse("unknown font", 404);
        const file = path.join(rendererDirectory, "fonts", name);
        if (!existsSync(file)) return errorResponse("unknown font", 404);
        return new Response(Bun.file(file), {
          headers: { "cache-control": "public, max-age=31536000, immutable", "content-type": "font/woff2" },
        });
      }
    }

    if (method === "GET" && route === "/v1/state") return Response.json(currentState());
    if (method === "GET" && route === "/v1/market/snapshot") {
      const body = await marketSnapshot.body(url.searchParams.get("refresh") === "1");
      return body ? Response.json(body) : errorResponse(marketSnapshot.view().warning ?? "market snapshot unavailable", 503);
    }
    if (method === "POST" && route === "/v1/gold/reset") {
      goldSession.reset();
      scheduleGoldSave();
      return Response.json(goldSession.snapshot());
    }
    if (method === "DELETE" && route === "/v1/gold/history") {
      goldSession.clearHistory();
      scheduleGoldSave();
      return new Response(null, { status: 204 });
    }
    if (method === "DELETE" && route.startsWith("/v1/gold/history/")) {
      let id: string;
      try {
        id = decodeURIComponent(route.slice("/v1/gold/history/".length));
      } catch {
        return errorResponse("invalid gold session id", 400);
      }
      if (!id || !goldSession.deleteSession(id)) return errorResponse("gold session not found", 404);
      scheduleGoldSave();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && route === "/v1/devices") return Response.json([]);
    if (method === "GET" && route === "/v1/history") return Response.json(session.history());
    if (method === "DELETE" && route === "/v1/history") {
      session.clearHistory();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && route === "/v1/profiles") {
      return Response.json({
        active: persisted.active,
        profiles: Object.entries(persisted.profiles).map(([name, text]) => ({ name, text })),
      });
    }
    if (method === "POST" && route.startsWith("/v1/sounds/") && route.endsWith("/play")) {
      // Lets the rule editor audition a sound through the same player the alerts use.
      const name = decodeURIComponent(route.slice("/v1/sounds/".length, -"/play".length));
      const bytes = soundBytes(name);
      if (!bytes) return errorResponse("unknown sound", 404);
      const played = options.playSound?.(bytes, persisted.soundVolume) ?? false;
      return Response.json({ played });
    }
    if (method === "GET" && (route.startsWith("/v1/icons/") || route.startsWith("/icons/"))) {
      const name = decodeURIComponent(route.replace(/^\/(?:v1\/)?icons\//, ""));
      if (!/^[A-Za-z0-9_.-]+\.webp$/.test(name)) return errorResponse("unknown icon", 404);
      const file = iconDirectories.map((directory) => path.join(directory, name)).find((candidate) => existsSync(candidate));
      if (!file) return errorResponse("unknown icon", 404);
      return new Response(Bun.file(file), {
        headers: { "cache-control": "public, max-age=86400", "content-type": "image/webp" },
      });
    }
    if (method === "PUT" && route === "/v1/settings") {
      const raw = await readText(request, 8_192);
      if (raw === null) return errorResponse("settings payload is too large", 413);
      let update: DesktopSettingsUpdate;
      try {
        update = JSON.parse(raw) as DesktopSettingsUpdate;
      } catch {
        return errorResponse("invalid JSON");
      }
      if ((update.soundsEnabled !== undefined && typeof update.soundsEnabled !== "boolean")
        || (update.soundVolume !== undefined && (typeof update.soundVolume !== "number"
          || !Number.isInteger(update.soundVolume) || update.soundVolume < 0 || update.soundVolume > 100))
        || (update.contributionEnabled !== undefined && typeof update.contributionEnabled !== "boolean")) {
        return errorResponse("invalid settings");
      }
      if (update.soundsEnabled !== undefined) persisted.soundsEnabled = update.soundsEnabled;
      if (update.soundVolume !== undefined) persisted.soundVolume = update.soundVolume;
      if (update.contributionEnabled !== undefined) {
        persisted.contributionEnabled = update.contributionEnabled;
        marketContributor.setEnabled(update.contributionEnabled);
        diagnostics.info("Market contribution setting changed", { enabled: update.contributionEnabled });
      }
      saveSettings(persisted);
      return Response.json(currentState());
    }
    if (method === "PUT" && route === "/v1/filter") {
      const filter = await readText(request, 128_000);
      if (filter === null) return errorResponse("filter payload is too large", 413);
      const invalid = invalidFilterResponse(filter);
      if (invalid) return invalid;
      persisted.profiles[persisted.active] = filter;
      applyFilter(filter);
      saveSettings(persisted);
      return Response.json(currentState().filter);
    }
    if (method === "POST" && route === "/v1/profiles") {
      const raw = await readText(request, 160_000);
      if (raw === null) return errorResponse("profile payload is too large", 413);
      let command: ProfileCommand;
      try {
        command = JSON.parse(raw) as ProfileCommand;
      } catch {
        return errorResponse("invalid JSON");
      }

      const name = normalizedProfileName(command.name);
      if (!name) return errorResponse("profile name must be 1-64 letters, numbers, spaces, underscores, or hyphens");
      if (!["create", "activate", "duplicate", "rename"].includes(command.action)) return errorResponse("unknown profile action");
      if (command.action === "create") {
        if (typeof command.text !== "string") return errorResponse("profile text is required");
        const invalid = invalidFilterResponse(command.text);
        if (invalid) return invalid;
        if (Object.hasOwn(persisted.profiles, name)) return errorResponse("profile already exists", 409);
        persisted.profiles[name] = command.text;
      } else if (command.action === "activate") {
        if (!Object.hasOwn(persisted.profiles, name)) return errorResponse("profile not found", 404);
        const invalid = invalidFilterResponse(persisted.profiles[name]!);
        if (invalid) return invalid;
        persisted.active = name;
        applyFilter(persisted.profiles[name]!);
      } else {
        const source = normalizedProfileName(command.source);
        if (!source || !Object.hasOwn(persisted.profiles, source)) return errorResponse("source profile not found", 404);
        if (Object.hasOwn(persisted.profiles, name)) return errorResponse("profile already exists", 409);
        persisted.profiles[name] = persisted.profiles[source]!;
        if (command.action === "rename") {
          delete persisted.profiles[source];
          if (persisted.active === source) {
            persisted.active = name;
            applyFilter(persisted.profiles[name]!);
          }
        }
      }
      saveSettings(persisted);
      return Response.json(currentState());
    }
    return errorResponse("not found", 404);
  }

  function localOrigin(origin: string): boolean {
    try {
      const hostname = new URL(origin).hostname;
      return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
    } catch {
      return false;
    }
  }

  function corsResponse(request: Request, response: Response): Response {
    const origin = request.headers.get("origin");
    if (!origin || !localOrigin(origin)) return response;
    const headers = new Headers(response.headers);
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-allow-methods", "GET, PUT, POST, DELETE, OPTIONS");
    headers.set("vary", "Origin");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  // Loopback only, on a port the system picks. A page on another site cannot read from it: its
  // requests carry that site's origin, which is refused before any route runs.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const origin = request.headers.get("origin");
      if (origin && !localOrigin(origin)) return errorResponse("origin is not allowed", 403);
      if (request.method === "OPTIONS") return corsResponse(request, new Response(null, { status: 204 }));
      try {
        return corsResponse(request, await routeRequest(request));
      } catch (error) {
        return corsResponse(request, errorResponse(error instanceof Error ? error.message : String(error), 500));
      }
    },
  });
  const port = server.port;
  if (port === undefined) throw new Error("The companion server did not receive a listening port.");
  diagnostics.info("Companion service ready", { port, contribution: persisted.contributionEnabled });

  let stopping = false;
  async function shutdown(): Promise<void> {
    if (stopping) return;
    stopping = true;
    server.stop(true);
    marketSnapshot.stop();
    await flushGoldSave();
    await marketContributor.shutdown().catch((error) =>
      diagnostics.warn("Market contributor did not stop cleanly during shutdown", { error: formatError(error) }));
  }

  /** Every alert sound by name: the built-in tones, then the player's own `.wav` files. */
  function soundNames(): string[] {
    return [...SOUND_NAMES, ...listCustomSounds(soundsDirectory).map((sound) => sound.name)];
  }

  /** Plays an alert sound by name at 0-100 volume, whatever the Companion's own alert settings say. */
  function playNamedSound(name: string, volume: number): boolean {
    try {
      const bytes = soundBytes(name);
      return bytes !== undefined && (options.playSound?.(bytes, volume) ?? false);
    } catch (error) {
      warning = `Could not play alert sound: ${formatError(error)}`;
      return false;
    }
  }

  return {
    origin: `http://127.0.0.1:${port}`,
    soundNames,
    playNamedSound,
    consumePacket,
    connectionOpened,
    connectionClosed,
    setCaptureStatus,
    activate,
    state: currentState,
    shutdown,
  };
}
