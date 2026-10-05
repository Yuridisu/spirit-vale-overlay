import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CharacterSnapshot } from "@kar-mi/spirit-vale-tools-character";
import { createBuildGuideService, normalizeBuildGuideSettings, SpiritValersClient } from "../src/index.ts";
import weaverClass from "./fixtures/weaver-class.json";
import weaverBuild from "./fixtures/weaver-build.json";
import world from "./fixtures/world.json";

const BUILD_ID = "9296c4b8-29b8-425d-bfee-268579aea8b6";

/** A client that answers from the fixtures, as spiritvalers.com would. */
function fixtureClient(cacheDir: string) {
  const routes = (url: string): unknown => {
    const route = new URL(url).pathname;
    if (route === "/spiritvale-all-classes.json") return { classes: { Weaver: weaverClass } };
    if (route === "/api/builds") return { rows: [{ id: BUILD_ID, name: weaverBuild.name, author: weaverBuild.author, cls: "Weaver", likes: 579 }] };
    if (route === "/rest/v1/builds") return [weaverBuild];
    const name = route.replace(/^\/wiki-data\//, "").replace(/\.json$/, "") as keyof typeof world | "worldmap";
    return (world as Record<string, unknown>)[name];
  };
  return new SpiritValersClient({ cacheDir, fetch: (async (url: string) => new Response(JSON.stringify(routes(url)))) as unknown as typeof fetch });
}

function weaver(skills: Record<string, number>): CharacterSnapshot {
  return {
    schemaVersion: 1, buildFingerprint: "", name: "Yuridisu", archetypes: ["Rogue", "Weaver"], level: 150, experience: 0, jobLevel: 70, jobExperience: 0,
    attributes: { STR: 1, VIT: 60, AGI: 99, DEX: 2, INT: 80, LUK: 1 }, activeLoadout: "Normal", equipment: [], artifacts: [],
    skills: Object.entries(skills).map(([id, level]) => ({ id, displayName: id, level, effects: [] })), updatedAt: "", source: "live",
  };
}

describe("build guide service", () => {
  test("lists the character's class, follows the chosen build and remembers it", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "guide-service-"));
    let character = weaver({ Heal: 5 });
    const characterListeners = new Set<() => void>();
    const service = createBuildGuideService({
      client: fixtureClient(path.join(dir, "cache")),
      settingsPath: path.join(dir, "build-guide.json"),
      getCharacter: () => character,
      subscribeCharacter: (listener) => { characterListeners.add(listener); return () => characterListeners.delete(listener); },
    });
    await service.start();
    expect(service.state()).toMatchObject({ className: "Weaver", classPicked: false, library: [{ id: BUILD_ID, likes: 579 }] });
    expect(service.overlayState()).toBeNull();

    await service.selectBuild(BUILD_ID);
    const selected = service.state().selected!;
    expect(selected.skills.trees[0]!.cells.find((cell) => cell.gameId === "Heal")).toMatchObject({ current: 5, target: 5 });
    expect(selected.missing.length).toBeGreaterThan(0);
    // Chosen, but the overlay follows it only once asked to.
    expect(service.overlayState()).toBeNull();

    service.setGuiding(true);
    const before = service.overlayState()!.skills.pointsLeft;
    character = weaver({ Heal: 5, WeaverMastery: 10 });
    for (const listener of characterListeners) listener();
    expect(service.overlayState()!.skills.pointsLeft).toBe(before - 10);

    await Bun.sleep(50);
    const saved = normalizeBuildGuideSettings(JSON.parse(await readFile(path.join(dir, "build-guide.json"), "utf8")));
    expect(saved).toMatchObject({ buildId: BUILD_ID, guiding: true, stage: 0 });
    service.stop();
  });

  test("settings keep only what is valid", () => {
    expect(normalizeBuildGuideSettings({ sort: "nope", stage: -1, guiding: "yes", buildId: 3 })).toEqual({ schemaVersion: 1, sort: "trending", stage: 0, guiding: false });
    expect(normalizeBuildGuideSettings({ sort: "liked", stage: 2, guiding: true, buildId: BUILD_ID, className: "Weaver" }))
      .toEqual({ schemaVersion: 1, sort: "liked", stage: 2, guiding: true, buildId: BUILD_ID, className: "Weaver" });
  });
});
