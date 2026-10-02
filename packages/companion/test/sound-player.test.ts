import { expect, test } from "bun:test";

import { scaleWavVolume } from "../src/bun/sound-player.ts";
import { SOUND_WAVS } from "../src/sounds.ts";

test("scales the samples of a 16-bit PCM WAV and leaves its header alone", () => {
  const wav = SOUND_WAVS.chime!;
  const half = scaleWavVolume(wav, 50);
  expect(half).not.toBe(wav);
  expect([...half.subarray(0, 44)]).toEqual([...wav.subarray(0, 44)]);
  const before = new DataView(wav.buffer, wav.byteOffset);
  const after = new DataView(half.buffer, half.byteOffset);
  let loudest = 0;
  for (let offset = 44; offset + 2 <= wav.length; offset += 2) {
    const sample = before.getInt16(offset, true);
    expect(after.getInt16(offset, true)).toBe(Math.round(sample * 0.5));
    loudest = Math.max(loudest, Math.abs(sample));
  }
  expect(loudest).toBeGreaterThan(1_000);
});

test("returns anything that is not a 16-bit PCM WAV unscaled", () => {
  const notWav = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  expect([...scaleWavVolume(notWav, 10)]).toEqual([...notWav]);
});
