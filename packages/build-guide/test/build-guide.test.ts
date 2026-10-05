import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { neededItems, planFarm, planSkillTabs, planSkills, skillTabs, SpiritValersClient } from "../src/index.ts";
import type { SiteBuildData, SiteClass, SiteWorldData } from "../src/index.ts";
import weaverClass from "./fixtures/weaver-class.json";
import weaverBuild from "./fixtures/weaver-build.json";
import world from "./fixtures/world.json";

// Fixtures are cut from spiritvalers.com's public data (classes, one public Weaver build by
// bosslan, and the wiki's drops, spawns, maps, world map and recipes).
const siteClass = weaverClass as SiteClass;
const build = weaverBuild.data as SiteBuildData;
const worldData = world as SiteWorldData;

describe("skill plan", () => {
  test("lays the class out on the game's own grid", () => {
    const plan = planSkills(siteClass, {}, build.skills!);
    expect([plan.rows, plan.cols]).toEqual([6, 7]);
    const at = (row: number, col: number) => plan.cells.find((cell) => cell.row === row && cell.col === col)?.name;
    expect([at(0, 0), at(0, 3), at(0, 6), at(5, 6)]).toEqual(["Heal", "Weaver Mastery", "Venom Strike", "Dual Wield Mastery"]);
  });

  test("always uses the game's seven by six grid, even for a class that fills fewer rows", () => {
    const short: SiteClass = { ...siteClass, gridLayout: Object.fromEntries(Object.entries(siteClass.gridLayout).slice(0, 5)) };
    const plan = planSkills(short, {}, {});
    expect([plan.rows, plan.cols]).toEqual([6, 7]);
  });

  test("an advanced class gets its base class's tab first, and points go there first", () => {
    const rogue: SiteClass = { ...siteClass, gameId: "Rogue", slug: "rogue", displayName: "Rogue", advancedClasses: ["Shinobi"] };
    const shinobi: SiteClass = { ...siteClass, gameId: "Shinobi", slug: "shinobi", displayName: "Shinobi", advancedClasses: [] };
    const classes = { Rogue: rogue, Shinobi: shinobi, Weaver: siteClass };
    expect(skillTabs(classes, shinobi).map((tree) => tree.displayName)).toEqual(["Rogue", "Shinobi"]);
    expect(skillTabs(classes, siteClass).map((tree) => tree.displayName)).toEqual(["Weaver"]);
    const tabs = planSkillTabs(classes, shinobi, {}, { heal: 5 });
    expect(tabs.map((tree) => [tree.className, tree.tab])).toEqual([["Rogue", 0], ["Shinobi", 1]]);
  });

  test("raises a skill's requirements first, even when the build lists them lower", () => {
    const plan = planSkills(siteClass, {}, { "ice-shard": 5 });
    expect(plan.steps).toEqual([
      { gameId: "Icebolt", name: "Icebolt", from: 0, to: 1 },
      { gameId: "IceShard", name: "Ice Shard", from: 0, to: 5 },
    ]);
    const icebolt = plan.cells.find((cell) => cell.gameId === "Icebolt")!;
    expect([icebolt.target, icebolt.required]).toEqual([1, true]);
    expect(plan.pointsLeft).toBe(6);
  });

  test("starts from the character's levels and reports points the build would put elsewhere", () => {
    const plan = planSkills(siteClass, { Heal: 5, Icebolt: 1, IceShard: 2, Firebolt: 4 }, { heal: 5, "ice-shard": 5 });
    expect(plan.steps).toEqual([{ gameId: "IceShard", name: "Ice Shard", from: 2, to: 5 }]);
    expect(plan.overspent.map((cell) => cell.name)).toEqual(["Firebolt"]);
  });

  test("the full build spends every point once", () => {
    const plan = planSkills(siteClass, {}, build.skills!);
    const total = Object.values(build.skills!).reduce((sum, level) => sum + level, 0);
    const required = plan.cells.filter((cell) => cell.required).reduce((sum, cell) => sum + cell.target, 0);
    expect(plan.pointsLeft).toBe(total + required);
  });
});

describe("farm plan", () => {
  test("lists gear, cards, artifacts and gems with their counts", () => {
    const items = neededItems(build);
    const vampire = items.find((item) => item.itemId === "Vampire Bat")!;
    expect([vampire.kind, vampire.count]).toEqual(["card", 4]);
    expect(items.find((item) => item.itemId === "EchoStaff")?.kind).toBe("equipment");
    expect(items.find((item) => item.itemId === "IceShard Gem")?.slots).toEqual(["rune"]);
  });

  test("finds where each missing item drops, best chance first, with its world-map square", () => {
    const plan = planFarm(neededItems(build), () => 0, worldData);
    const vespa = plan.missing.find((item) => item.itemId === "Sting")!;
    const drop = vespa.sources[0]!;
    expect(drop.kind).toBe("drop");
    if (drop.kind !== "drop") return;
    expect(drop.chance).toBeGreaterThan(0);
    expect(drop.expectedKills).toBe(Math.ceil(100 / drop.chance));
    expect(drop.maps.length).toBeGreaterThan(0);
    expect(drop.maps.some((map) => map.tile !== undefined)).toBe(true);
    expect(plan.squares.length).toBeGreaterThan(0);
  });

  test("artifacts are sought per slot, from the monsters that drop that piece in that slot", () => {
    const plan = planFarm(neededItems(build), () => 0, worldData);
    const relic = plan.missing.find((item) => item.kind === "artifact" && item.slots[0] === "relic")!;
    const sources = relic.sources.filter((source) => source.kind === "drop");
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.some((source) => source.kind === "drop" && source.monster === "Earth Wisp")).toBe(true);
    expect(plan.missing.filter((item) => item.kind === "artifact").map((item) => item.slots[0])).toEqual(["rune", "jewel", "scroll", "relic"]);
  });

  test("items the site crafts carry their recipe", () => {
    const plan = planFarm(neededItems(build), () => 0, worldData);
    const armlets = plan.missing.find((item) => item.itemId === "DiscipleArmlets")!;
    expect(armlets.sources.some((source) => source.kind === "craft" && source.materials.length > 0)).toBe(true);
  });

  test("what the character already has is set apart", () => {
    const plan = planFarm(neededItems(build), (item) => (item.itemId === "Vampire Bat" ? 4 : item.itemId === "Sting" ? 1 : 0), worldData);
    expect(plan.owned.map((item) => item.itemId).sort()).toEqual(["Sting", "Vampire Bat"]);
    expect(plan.missing.some((item) => item.itemId === "Sting")).toBe(false);
  });
});

describe("spiritvalers client", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  test("asks for one class's library and keeps the answer", async () => {
    const urls: string[] = [];
    const client = new SpiritValersClient({
      cacheDir: await mkdtemp(path.join(os.tmpdir(), "sv-guide-")),
      fetch: (async (url: string) => {
        urls.push(url);
        return json({ rows: [{ id: "9296c4b8-29b8-425d-bfee-268579aea8b6", name: "W", author: "a", cls: "Weaver" }, { id: "bad", name: "x" }] });
      }) as typeof fetch,
    });
    const rows = await client.library("Weaver");
    await client.library("Weaver");
    expect(rows.map((row) => row.name)).toEqual(["W"]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/api/builds?shape=library&sort=trending&limit=50&offset=0&class=Weaver");
  });

  test("falls back to the last good answer when the site is down", async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "sv-guide-"));
    let now = 0;
    let online = true;
    const options = {
      cacheDir,
      now: () => now,
      fetch: (async () => (online ? json({ classes: { Weaver: siteClass } }) : json({}, 503))) as unknown as typeof fetch,
    };
    expect(Object.keys(await new SpiritValersClient(options).classes())).toEqual(["Weaver"]);
    online = false;
    now += 7 * 60 * 60 * 1000;
    expect(Object.keys(await new SpiritValersClient(options).classes())).toEqual(["Weaver"]);
  });

  test("refuses anything that is not a build id", async () => {
    const client = new SpiritValersClient({ cacheDir: os.tmpdir(), fetch: (async () => json([])) as unknown as typeof fetch });
    await expect(client.build("1;drop")).rejects.toThrow("not a build id");
  });
});
