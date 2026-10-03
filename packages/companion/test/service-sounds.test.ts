import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCompanionService } from "../src/bun/service.ts";
import { SOUND_NAMES, SOUND_WAVS } from "../src/sounds.ts";

const root = mkdtempSync(path.join(tmpdir(), "companion-service-sounds-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("lists and plays alert sounds by name for the overlay, at the volume it asks for", async () => {
  const dataDirectory = path.join(root, "data");
  mkdirSync(path.join(dataDirectory, "sounds"), { recursive: true });
  writeFileSync(path.join(dataDirectory, "sounds", "raid-horn.wav"), "RIFF-horn");
  const played: Array<[Uint8Array, number]> = [];
  const service = await createCompanionService({
    dataDirectory,
    rendererDirectory: path.join(root, "renderer"),
    version: "test",
    playSound: (wav, volume) => { played.push([wav, volume]); return true; },
  });
  try {
    expect(service.soundNames()).toEqual([...SOUND_NAMES, "raid-horn"]);
    expect(service.playNamedSound("ding", 30)).toBe(true);
    expect(service.playNamedSound("Raid-Horn", 55)).toBe(true);
    expect(service.playNamedSound("missing", 55)).toBe(false);
    expect(played.map(([wav, volume]) => [Buffer.from(wav).toString("latin1").slice(0, 9), volume])).toEqual([
      [Buffer.from(SOUND_WAVS.ding!).toString("latin1").slice(0, 9), 30],
      ["RIFF-horn", 55],
    ]);
  } finally {
    await service.shutdown();
  }
});
