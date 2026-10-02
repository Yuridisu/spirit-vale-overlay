import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { importFromPreviousVersion } from "./previous-version-import.ts";

const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function parentFolder(): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), "svo-import-"));
  scratch.push(directory);
  return directory;
}

function release(parent: string, version: string, files: Record<string, string> = {}): string {
  const root = path.join(parent, `spirit-vale-overlay-windows-x64-v${version}`);
  mkdirSync(path.join(root, "data", "settings"), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, "data", name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return root;
}

test("copies settings and data from the newest release folder beside a fresh one", async () => {
  const parent = parentFolder();
  release(parent, "0.10.9", { "settings/overlay.json": "old" });
  const previous = release(parent, "0.10.11", {
    "settings/overlay.json": "positions",
    "boss-timers.json": "timers",
    "companion/settings.json": "rules",
    "companion/logs/companion.log": "log",
    "logs/session.jsonl": "log",
  });
  const fresh = release(parent, "0.10.12");

  expect(await importFromPreviousVersion(fresh)).toEqual({ from: previous, version: "0.10.11" });
  expect(readFileSync(path.join(fresh, "data", "settings", "overlay.json"), "utf8")).toBe("positions");
  expect(readFileSync(path.join(fresh, "data", "boss-timers.json"), "utf8")).toBe("timers");
  expect(readFileSync(path.join(fresh, "data", "companion", "settings.json"), "utf8")).toBe("rules");
  expect(existsSync(path.join(fresh, "data", "companion", "logs"))).toBe(false);
  expect(existsSync(path.join(fresh, "data", "logs"))).toBe(false);
});

test("leaves a folder that already has settings alone", async () => {
  const parent = parentFolder();
  release(parent, "0.10.11", { "settings/overlay.json": "old positions" });
  const current = release(parent, "0.10.12", { "settings/overlay.json": "mine" });

  expect(await importFromPreviousVersion(current)).toBeUndefined();
  expect(readFileSync(path.join(current, "data", "settings", "overlay.json"), "utf8")).toBe("mine");
});

test("does nothing without a release folder beside it, or outside a release folder", async () => {
  const parent = parentFolder();
  expect(await importFromPreviousVersion(release(parent, "0.10.12"))).toBeUndefined();

  const elsewhere = path.join(parent, "my-own-folder");
  mkdirSync(elsewhere);
  release(parent, "0.10.11", { "settings/overlay.json": "positions" });
  expect(await importFromPreviousVersion(elsewhere)).toBeUndefined();
});
