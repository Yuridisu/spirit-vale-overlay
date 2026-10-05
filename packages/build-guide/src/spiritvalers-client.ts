import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SiteBuildData, SiteBuildRow, SiteClass, SiteWorldData } from "./site-types.ts";

export const SPIRITVALERS_ORIGIN = "https://spiritvalers.com";

/** How the library is ordered, as the site names its sorts. */
export type BuildSort = "trending" | "liked" | "recent";

const HOUR = 60 * 60 * 1000;
const TTL = { reference: 6 * HOUR, library: 30 * 60 * 1000, build: 30 * 60 * 1000 } as const;
const BUILD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SpiritValersClientOptions {
  /** Where answers are kept between runs, so the guide works offline with the last data. */
  cacheDir: string;
  fetch?: typeof fetch;
  now?: () => number;
  origin?: string;
}

interface Cached<T> {
  fetchedAt: number;
  body: T;
}

/**
 * Reads spiritvalers.com for the build guide: the public build library, one build, and the wiki
 * data that says where things drop. Every answer is cached in memory and on disk; a failed request
 * falls back to the last good answer, however old.
 */
export class SpiritValersClient {
  private readonly memory = new Map<string, Cached<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly origin: string;

  constructor(private readonly options: SpiritValersClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.origin = (options.origin ?? SPIRITVALERS_ORIGIN).replace(/\/$/, "");
  }

  /** Every class with its skill grid. */
  async classes(): Promise<Record<string, SiteClass>> {
    const body = await this.get<{ classes: Record<string, SiteClass> }>("classes", "/spiritvale-all-classes.json", TTL.reference);
    return body.classes;
  }

  /** The public builds of one class (the game's class name, e.g. "Weaver"). */
  async library(className: string, sort: BuildSort = "trending"): Promise<SiteBuildRow[]> {
    const query = new URLSearchParams({ shape: "library", sort, limit: "50", offset: "0", class: className });
    const body = await this.get<{ rows?: SiteBuildRow[] }>(`library-${className}-${sort}`, `/api/builds?${query}`, TTL.library);
    return (body.rows ?? []).filter((row) => typeof row.id === "string" && BUILD_ID.test(row.id));
  }

  /** One build in full, with its stages. */
  async build(id: string): Promise<{ id: string; name: string; author: string; data: SiteBuildData }> {
    if (!BUILD_ID.test(id)) throw new Error("not a build id");
    const rows = await this.get<Array<{ name: string; author: string; data: SiteBuildData }>>(
      `build-${id}`, `/rest/v1/builds?id=eq.${id}&select=data,author,name`, TTL.build);
    const row = rows[0];
    if (!row?.data) throw new Error("build not found");
    return { id, name: row.name, author: row.author, data: row.data };
  }

  /** Drops, spawns, maps, the world map and recipes, for the farming plan. */
  async world(): Promise<SiteWorldData> {
    const [drops, monsters, spawns, maps, worldmap, crafting] = await Promise.all([
      this.get<SiteWorldData["drops"]>("drops", "/wiki-data/drops.json", TTL.reference),
      this.get<SiteWorldData["monsters"]>("monsters", "/wiki-data/monsters.json", TTL.reference),
      this.get<SiteWorldData["spawns"]>("spawns", "/wiki-data/spawns.json", TTL.reference),
      this.get<SiteWorldData["maps"]>("maps", "/wiki-data/maps.json", TTL.reference),
      this.get<SiteWorldData["worldmap"]>("worldmap", "/wiki-data/worldmap.json", TTL.reference),
      this.get<SiteWorldData["crafting"]>("crafting", "/wiki-data/crafting.json", TTL.reference),
    ]);
    return { drops, monsters, spawns, maps, worldmap, crafting };
  }

  /** The build's page on the site, to open in the browser. */
  buildUrl(id: string): string {
    return `${this.origin}/simulator?id=${encodeURIComponent(id)}&view=1`;
  }

  private async get<T>(key: string, route: string, ttl: number): Promise<T> {
    const memory = this.memory.get(key) as Cached<T> | undefined;
    if (memory && this.now() - memory.fetchedAt < ttl) return memory.body;
    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return pending;
    const request = this.load<T>(key, route, ttl, memory).finally(() => this.inflight.delete(key));
    this.inflight.set(key, request);
    return request;
  }

  private async load<T>(key: string, route: string, ttl: number, memory: Cached<T> | undefined): Promise<T> {
    const disk = memory ?? await this.readCache<T>(key);
    if (disk && this.now() - disk.fetchedAt < ttl) {
      this.memory.set(key, disk);
      return disk.body;
    }
    try {
      const response = await this.fetch(`${this.origin}${route}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`spiritvalers.com returned HTTP ${response.status}`);
      const body = await response.json() as T;
      const fresh = { fetchedAt: this.now(), body };
      this.memory.set(key, fresh);
      await this.writeCache(key, fresh);
      return body;
    } catch (error) {
      if (disk) {
        this.memory.set(key, disk);
        return disk.body;
      }
      throw error;
    }
  }

  private cachePath(key: string): string {
    return path.join(this.options.cacheDir, `${key.replace(/[^a-z0-9-]+/gi, "_")}.json`);
  }

  private async readCache<T>(key: string): Promise<Cached<T> | undefined> {
    try {
      const cached = JSON.parse(await readFile(this.cachePath(key), "utf8")) as Cached<T>;
      return typeof cached?.fetchedAt === "number" && cached.body !== undefined ? cached : undefined;
    } catch {
      return undefined;
    }
  }

  private async writeCache<T>(key: string, value: Cached<T>): Promise<void> {
    const file = this.cachePath(key);
    const temporary = `${file}.${process.pid}.tmp`;
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(temporary, JSON.stringify(value));
      await rename(temporary, file);
    } catch {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }
}
