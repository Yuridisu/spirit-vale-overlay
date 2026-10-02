# Changelog

Each released version has a section headed `## <version>`. The release workflow publishes that
section as the GitHub Release notes, so write it for the people who use the app.

## 0.10.12

### Added

- **Companion window.** The bag, loot rules, gold sessions and market of
  [Vale Companion](https://github.com/bjb2/valecompanion) by bjb2 are now part of this app, with the
  author's agreement. Open it from the Companion tile on the main window.
  - **Bag and storage.** Everything you carry and everything in your personal storage, with each
    item's rolled stats, roll percentages and an estimated market value.
  - **Loot rules.** Write `Show` and `Hide` rules by name, type, stat, roll quality, refine and more,
    each with its own colour, tag and sound. Rules are kept in named profiles, and a starter set is
    included. Matching drops are listed in an alert history.
  - **Alert sounds.** Five built-in sounds, or your own `.wav` files, with a volume setting. They
    play whether or not the Companion window is open.
  - **Gold sessions.** Gross and net gold per hour, spending, a 15-minute pace, gold per kill and a
    history of your finished sessions.
  - **Market.** Browse the current community listings and each item's seven-day asking prices. The
    listings come from market-api.spiritvalers.com and are only fetched once you open the Companion.
  - **Market contribution, off by default.** If you turn it on in the Companion's settings, the
    listings you see while browsing the market in game are uploaded to that service, which is what
    fills the market for everyone. Your character, the sellers and raw game traffic are never
    sent. The setting says exactly what is.

## 0.10.11

### Added

- **Gear and artifact pickup cards.** When you pick up a piece of equipment or an artifact, a card
  shows its name, slot, refine level, and every rolled stat with its value and roll percentage.
  They are two separate elements, so each can sit where you want it: enable Gear pickups and
  Artifact pickups under Settings > Overlay > Visible elements. A card stays for 15 seconds;
  several items picked up together take turns, one card at a time.
- **Timer element.** A personal countdown or stopwatch over the game. Set the mode and the
  countdown length from the Timer panel on the main window, which also has Start/Pause and Reset
  buttons. In game, `Ctrl+Shift+9` starts and pauses it and `Ctrl+Shift+0` resets it; both can be
  rebound. A countdown flashes when it reaches zero until you press start or reset.
- **Kill counter element.** Lists the monsters you have killed on the current map and how many
  of each, most killed first, with the experience and gold those kills paid. It starts over when
  you change map.
- **Boss DPS element.** A meter for boss fights only: which boss, the total damage dealt to it, the
  damage per second, how long the fight has lasted, and every player ranked by their damage to the
  boss. Hits on other monsters are left out. The last fight stays on show until the next one starts.
- **Boss Fight Analysis tab in the Combat window.** Every boss fight is recorded with its map,
  length, the party's total damage and DPS, and each player's damage, share, hits, crit rate and
  deaths. Click a player to see which skills their damage came from. The loot that dropped when the
  boss died is listed too. Up to 30 fights are kept across restarts, with a button to clear them.
- **Damage taken element.** What has been hitting you, by the monster and the skill or attack
  that dealt it, with each one's share of the total. It counts whether or not you are fighting back,
  and starts over after a minute without being hit or when you change map.
- **Gear ratings element.** Rates each equipped item's rolled stats out of six stars, in half-star
  steps, laid out in the two columns of the game's equipment screen so each rating sits beside its
  slot. The overlay cannot see that screen open, so `Ctrl+Shift+G` shows the ratings and that key
  or Escape hides them; bind it to the key that opens your equipment screen to have both together.
- **Item counter element.** Follow up to eight items you are farming and see how many of each you
  carry while you hunt, with what you have picked up since the app started beside it. Choose the
  items in the Rewards window, under Item counter, by clicking them in the list of what is in your
  bag or typing their names. The count is the one the game reports for your bag, which it sends
  again with every pickup.
- **DPS details element.** Breaks your encounter damage down by the skill or attack that dealt
  it, with each one's share of the total.

### Changed

- **Loot notifications only show drops you can pick up.** A drop locked to another player is no
  longer announced. The filter engages once the overlay has recognised one of your own drops, and
  it never hides a drop locked to your party.

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
