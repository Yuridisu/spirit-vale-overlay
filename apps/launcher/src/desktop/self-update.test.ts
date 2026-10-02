import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { canSelfUpdate, findStagedRoot, stageUpdate, updateWorkDirectory } from "./self-update.ts";

const scratch: string[] = [];
afterEach(() => {
  for (const directory of scratch.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function bundle(directory: string): string {
  for (const file of ["spirit-vale-overlay-win_x64.exe", "resources.neu", "extensions/backend/index.js", "extensions/bin/bun.exe"]) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), "x");
  }
  return directory;
}

function installation(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "svo-update-"));
  scratch.push(root);
  return bundle(root);
}

const body = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
const release = { url: "https://example.test/update.zip", size: body.length, sha256: createHash("sha256").update(body).digest("hex") };
const serve = (bytes: Uint8Array) => (async () => new Response(new Blob([bytes.slice()]))) as unknown as typeof fetch;
/** Stands in for unpacking the ZIP: puts a complete bundle where the ZIP's one folder would land. */
const unpackBundle = async (_zip: string, destination: string): Promise<void> => { bundle(path.join(destination, "release-folder")); };

test("only a complete portable Windows bundle can update itself", () => {
  const root = installation();
  expect(canSelfUpdate(root, "win32")).toBe(true);
  expect(canSelfUpdate(root, "linux")).toBe(false);
  expect(canSelfUpdate(undefined, "win32")).toBe(false);
  rmSync(path.join(root, "resources.neu"));
  expect(canSelfUpdate(root, "win32")).toBe(false);
});

test("stages a download whose size and checksum match the release", async () => {
  const root = installation();
  const progress: number[] = [];
  const staged = await stageUpdate({
    root,
    download: release,
    fetcher: serve(body),
    extract: unpackBundle,
    onProgress: (received, total) => progress.push(received / total),
  });

  expect(staged.workDirectory).toBe(updateWorkDirectory(root));
  expect(staged.stagedRoot).toBe(path.join(updateWorkDirectory(root), "staged", "release-folder"));
  expect(progress.at(-1)).toBe(1);
  expect(existsSync(path.join(root, "resources.neu"))).toBe(true);
});

test("refuses a download that is not the one the release describes", async () => {
  const root = installation();
  const tampered = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
  await expect(stageUpdate({ root, download: release, fetcher: serve(tampered), extract: unpackBundle }))
    .rejects.toThrow("checksum");
  await expect(stageUpdate({ root, download: release, fetcher: serve(body.subarray(0, 4)), extract: unpackBundle }))
    .rejects.toThrow("cut short");
  await expect(stageUpdate({ root, download: release, fetcher: serve(new Uint8Array(64)), extract: unpackBundle }))
    .rejects.toThrow("larger");
  await expect(stageUpdate({ root, download: release, fetcher: (async () => new Response("", { status: 404 })) as unknown as typeof fetch, extract: unpackBundle }))
    .rejects.toThrow("HTTP 404");
});

test("refuses an archive that does not hold a complete bundle", async () => {
  const root = installation();
  const unpackPartial = async (_zip: string, destination: string): Promise<void> => {
    mkdirSync(path.join(destination, "release-folder"), { recursive: true });
    writeFileSync(path.join(destination, "release-folder", "resources.neu"), "x");
  };
  await expect(stageUpdate({ root, download: release, fetcher: serve(body), extract: unpackPartial }))
    .rejects.toThrow("not a complete");
  expect(findStagedRoot(path.join(root, "nowhere"))).toBeUndefined();
});
