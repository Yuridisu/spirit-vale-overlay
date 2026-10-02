import { dlopen, FFIType, ptr } from "bun:ffi";

import { SOUND_WAVS } from "../sounds.ts";

const SND_ASYNC = 0x0001;
const SND_NODEFAULT = 0x0002;
const SND_MEMORY = 0x0004;

type PlaySound = (sound: ReturnType<typeof ptr>, module: null, flags: number) => boolean;

let playSoundW: PlaySound | null | undefined;
/** Windows reads the sound while it plays, so the buffer has to outlive the call that started it. */
const playing: { buffer?: Uint8Array } = {};

function loadPlaySound(): PlaySound | null {
  if (process.platform !== "win32") return null;
  try {
    const winmm = dlopen("winmm", {
      PlaySoundW: { args: [FFIType.ptr, FFIType.ptr, FFIType.u32], returns: FFIType.bool },
    });
    return winmm.symbols.PlaySoundW as unknown as PlaySound;
  } catch (error) {
    console.warn("[companion] alert sounds are unavailable:", error);
    return null;
  }
}

/**
 * Plays a WAV through Windows itself, without a browser window in between: the overlay is
 * click-through and so never gets the user gesture a web page needs before it may make sound.
 * A sound still playing is cut short by the next one. Returns whether playback was started.
 */
export function playWav(wav: Uint8Array, volume: number): boolean {
  playSoundW ??= loadPlaySound();
  if (!playSoundW) return false;
  if (volume <= 0) return false;
  const buffer = scaleWavVolume(wav, volume);
  playing.buffer = buffer;
  return playSoundW(ptr(buffer), null, SND_MEMORY | SND_ASYNC | SND_NODEFAULT);
}

/** Plays one of the built-in alert tones: blip, chime, ding, alert or thud. */
export function playBuiltinSound(name: string, volume: number): boolean {
  const wav = SOUND_WAVS[name];
  return wav === undefined ? false : playWav(wav, volume);
}

/**
 * Returns a copy of a 16-bit PCM WAV with every sample scaled to `volume` percent. Any other
 * format is returned unscaled, at full volume, rather than refused.
 */
export function scaleWavVolume(wav: Uint8Array, volume: number): Uint8Array {
  const copy = new Uint8Array(wav);
  const gain = Math.max(0, Math.min(100, volume)) / 100;
  if (gain === 1) return copy;
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  if (copy.length < 12 || ascii(copy, 0) !== "RIFF" || ascii(copy, 8) !== "WAVE") return copy;
  let pcm16 = false;
  for (let offset = 12; offset + 8 <= copy.length;) {
    const id = ascii(copy, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt " && body + 16 <= copy.length) {
      pcm16 = view.getUint16(body, true) === 1 && view.getUint16(body + 14, true) === 16;
    } else if (id === "data") {
      if (!pcm16) return copy;
      const end = Math.min(copy.length, body + size);
      for (let sample = body; sample + 2 <= end; sample += 2) {
        view.setInt16(sample, Math.round(view.getInt16(sample, true) * gain), true);
      }
      return copy;
    }
    // Chunks are padded to an even length.
    offset = body + size + (size & 1);
  }
  return copy;
}

function ascii(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset]!, bytes[offset + 1]!, bytes[offset + 2]!, bytes[offset + 3]!);
}
