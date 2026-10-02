# Changelog

Each released version has a section headed `## <version>`. The release workflow publishes that
section as the GitHub Release notes, so write it for the people who use the app.

## 0.10.10

First release of the community continuation. The original project by
[kar-mi](https://github.com/kar-mi/spirit-vale-overlay) stopped at 0.10.9.

### Fixed

- **Works with the 2026-10-01 game update.** The update renumbered the game's network messages,
  which stopped the overlay from reading your character, your channel, and more.
- **Your own name, class, and XP bar now show up on Windows 11.** Windows merges bursts of network
  packets by default (UDP Receive Offload) and the overlay was only reading the first one, so the
  message carrying your character was lost. You showed as "Unidentified" and the XP bars stayed on
  "Waiting". Rewards are attributed to you again as a result.
- **Boss timers are kept per channel.** A gravestone seen before the game announced the channel was
  stored with no place, so each channel overwrote the last. It is now placed once the channel is
  known, giving one timer per channel.

### Added

- **Gravestones on the minimap.** A standing boss gravestone is marked with a cross, pinned to the
  rim as a bearing when it is out of range.
- **Radar range setting** (Settings > Minimap / Loot). The default now lines the radar up with the
  game's own minimap fully zoomed out; it used to be far more zoomed in.
- **Clock element.** Shows your computer's time over the game. Enable it under Settings > Overlay >
  Visible elements, then place and resize it like any other element.
- **Box of Mastery always shows** in loot notifications and on the radar, whatever the rarity and
  drop-chance filters are set to. The game sends it below Epic.

### For developers

- The `spirit-vale-tools` packages now live in this repository under `tools/`, so building needs no
  registry token.
- `tools/scripts/refresh-rpc-map.ts` renumbers the bundled message map from the installed game's
  files after a game update.
