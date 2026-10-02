/** SHA-256 of the canonical current-build source manifest. */
export const CURRENT_GAME_BUILD_FINGERPRINT = "39924708627796746e9da486486b0a3ca207a92df80f1aa3e3af1a11fd88bb93";

export const BUNDLED_GAME_BUILD_FINGERPRINTS = [
  CURRENT_GAME_BUILD_FINGERPRINT,
] as const;

export type GameBuildFingerprint = (typeof BUNDLED_GAME_BUILD_FINGERPRINTS)[number];
