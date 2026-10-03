import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { replaceFile } from "./replace-file.ts";

const root = mkdtempSync(path.join(tmpdir(), "replace-file-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

function busy(code: string): Error {
  return Object.assign(new Error(`${code}: operation not permitted, rename`), { code });
}

test("waits out a target another process briefly holds open", async () => {
  const from = path.join(root, "pointer.json.tmp");
  const to = path.join(root, "pointer.json");
  writeFileSync(from, "new");
  writeFileSync(to, "old");
  let refusals = 0;
  await replaceFile(from, to, {
    delayMs: 1,
    rename: async (source, target) => {
      if (refusals < 3) { refusals += 1; throw busy(refusals === 2 ? "EBUSY" : "EPERM"); }
      const { rename } = await import("node:fs/promises");
      await rename(source, target);
    },
  });
  expect(refusals).toBe(3);
  expect(readFileSync(to, "utf8")).toBe("new");
});

test("passes other failures on at once, and gives up on a target that stays busy", async () => {
  const from = path.join(root, "settings.json.tmp");
  writeFileSync(from, "x");
  let calls = 0;
  await expect(replaceFile(from, path.join(root, "settings.json"), {
    delayMs: 1,
    rename: async () => { calls += 1; throw busy("ENOENT"); },
  })).rejects.toThrow("ENOENT");
  expect(calls).toBe(1);

  writeFileSync(from, "x");
  calls = 0;
  await expect(replaceFile(from, path.join(root, "settings.json"), {
    attempts: 4,
    delayMs: 1,
    rename: async () => { calls += 1; throw busy("EPERM"); },
  })).rejects.toThrow("EPERM");
  expect(calls).toBe(4);
  // The half-finished write is not left behind.
  expect(existsSync(from)).toBe(false);
});
