# Changelog

Each released version has a section headed `## <version>`. The release workflow publishes that
section as the GitHub Release notes, so write it for the people who use the app.

## 0.10.14

### Added

- **Build Guide.** A new Build Guide tile opens the public builds of
  [spiritvalers.com](https://spiritvalers.com/builds) for your class, ordered by trending, most
  liked or most recent. Pick one, and a stage if it has several, and the guide lays it over your
  character:
  - **Skills:** your class's skill tree laid out as in the game, with a tab for the base class and
    one for the advanced class, each skill with your level and the build's, and the order to spend
    your points in, with any skill another one needs first.
  - **Farm:** every item the build uses that you do not have, gear, cards, gems and artifacts, each
    with where it best drops (chance, monster, about how many kills, maps), or its recipe.
  - **Attributes:** what the build puts in each attribute and how many you still have to add.
- **The Build Guide in the overlay.** Press Guide me in the overlay and two new overlay elements
  follow that build: Build guide: skills, with the skill tree, the skills to raise and the next one
  first, and Build guide: farm, with what is still missing and where it best drops. Turn them on
  in Settings > Overlay.
- **Loot filter alerts on screen.** Items that match one of your Companion loot rules now also
  show on the overlay, as a card in the rule's colour with the item's icon and rolls. Turn on the
  Loot filter alerts element in Settings > Overlay.

### Changed

- **A new look for the whole app.** The overlay and every window now look like a stream
  broadcast: dark plates with a cut corner, a coloured tag naming each element, large condensed
  numbers and easy-to-read names, and striped rows. Each tool has its own colour, on its tile and
  in its window. In the meters each player keeps one colour, the same in every table. Time left is
  drawn as a bar on buffs, boss timers and the countdown, and alerts flash once and then hold
  instead of blinking. Your layout, sizes and opacities stay as they were.
- **Prefer the old look? Switch back.** Settings > General > Visual style switches every window
  and the overlay between the new look and the classic 0.10.13 one, at once, with nothing else
  changing. Both looks share your layout, so an element you sized for one may need a resize in
  the other.
- **Skill points show at once.** Pressing Apply in the game's skill window now updates your
  character, the Character window and the Build Guide right away, instead of after the next map
  change.

### Credits

- Builds are written by their authors on spiritvalers.com and shown with their names. The skill
  trees, drops and maps come from spiritvalers.com by **Buh
  ([bjb2](https://github.com/bjb2))**. Thank you, Buh.

## 0.10.13

### Added

- **Twelve target drops.** Hunt up to twelve drops at once instead of four.
- **Target drops by type.** Each target now has a Type next to its name: any equipment, any
  weapon, any artifact, one equipment slot (Head, Chest, Feet and so on), one weapon kind, or one
  artifact piece (Rune, Jewel, Scroll, Relic). With a type the name is optional, so a target can be
  any headgear with Int 3, or any artifact with Matk % 2. Targets saved before keep working as they
  were.
- **A sound for each target drop.** Pick one of the five built-in tones or one of your own `.wav`
  files for each target, try it with Play, and set how loud target drops play. Your own sounds are
  the ones you add in the Companion's settings.
- **Boss DPS splits a fight with several bosses.** Fighting two bosses at once still gives one
  total, and below it each boss now has its own block: its damage, pace and players, with a defeated
  boss struck through. In the Combat window's Boss Fight Analysis, buttons above the tables switch
  between all bosses and each one.

### Fixed

- **Capture starts on the first try.** Opening the app often showed "Unable to capture data, please
  close the app and restart it": while the windows were starting and reading the app's log
  pointers, Windows refused to let capture replace one of them, and capture gave up. It now waits a
  moment and tries again, and so do settings and the session journal.
- **Starting the app again while it runs shows the one already open.** The second copy used to
  open a window stuck on "Reconnecting to the capture service" that could not even be closed. It
  now closes itself and brings the running app's launcher forward, from the tray too.
- **Hits on bosses are read through the whole fight.** The game sometimes despawns a boss from a
  player's view mid-fight while still sending the hits on it, and every hit after that was being
  dropped, so long boss fights showed little or no damage on the boss. Those hits are now kept, as
  long as they match what the boss registered when it appeared. Status effects and movement on such
  objects come back the same way.
- **Summons stay on the Summons element while they are out.** The game reports summons as gone
  when they are not, on a new floor of the Eternal Tower and now and then mid-fight, and they
  dropped off the list for good. A summon reported gone now leaves only once nothing more is heard
  of it for a few seconds.
- **Reflected damage counts as damage taken.** Damage a monster reflects reached the meters as if a
  player had dealt it, filling them with "Unidentified" rows and the reflecting monster itself.

## 0.10.12

### Added

- **Companion window.** The bag, loot rules, gold sessions and market of
  [Vale Companion](https://github.com/bjb2/valecompanion) by Buh (bjb2) are now part of this app,
  with the author's agreement. Open it from the Companion tile on the main window.
  - **Bag and storage.** Everything you carry and everything in your personal storage, with item
    icons, each item's rolled stats and roll percentages, and an estimated market value. The game
    sends the bag with your first kill or pickup after the app starts, so it is empty until then;
    the storage fills in when you open it or move an item.
  - **Loot rules.** Write `Show` and `Hide` rules by name, type, stat, roll quality, refine and more,
    each with its own colour, tag and sound. Rules are kept in named profiles, and a starter set is
    included. Matching drops are listed in an alert history.
  - **Alert sounds.** Five built-in sounds, or your own `.wav` files, with a volume setting. They
    play whether or not the Companion window is open. They start off; turn on Loot alerts in the
    Companion's settings to hear your rules.
  - **Gold sessions.** Gross and net gold per hour, spending, a 15-minute pace, gold per kill and a
    history of your finished sessions.
  - **Market.** Browse the community listings and each item's seven-day asking prices. They come
    from market-api.spiritvalers.com, which only knows the listings its contributors have seen in
    game, so an item nobody has browsed has no price yet. Nothing is fetched until you open the
    Companion.
  - **Market contribution, off by default.** If you turn it on in the Companion's settings, the
    listings you see while browsing the market in game are uploaded to that service, which is what
    fills the market for everyone. Your character, the sellers and raw game traffic are never
    sent. The setting says exactly what is.
- **Summons element.** Your summons and how they are holding up: each one with the icon and name
  of the skill that raised it (Skeleton, Skeleton Mage, Abomination, Reanimation and so on), a health
  bar with its health and share of maximum, and the buffs and debuffs on it with their time left. How
  many are out and the lowest health show at the top. Enable it under Settings > Overlay > Visible
  elements.
- **Overlay presets.** Save the overlay as it is, under a name, and switch between your saved
  layouts: which elements are on, where they sit, their size and opacity, the meter and minimap
  options, the timer, the item counter and the target drops. Manage them under Settings > Overlay >
  Presets, and step through them in game with `Ctrl+Shift+P`, which can be rebound.
- **Target drops.** Name up to four drops you are hunting, each with the stats it must have and
  the least of each, such as a Starfire Jewel with Int 3, Mp % 2 and Matk % 2. When you pick one
  up, the overlay's Target drops element announces it under a banner, with a sound if you want
  one. Items without rolls, such as materials and cards, can be targeted by name alone. Set them in
  the Rewards window, under Target drops, and enable the element under Settings > Overlay > Visible
  elements.
- **Who killed you.** The Damage taken element now shows your last death first: the monster, the
  attack that landed the killing blow, its damage and the time. It stays until your next death,
  through the trip back to town.

- **Update from inside the app.** When a new version is out, the notice on the main window has an
  Update now button. It downloads the release, checks it against the checksum GitHub publishes,
  swaps the files and reopens the app. Your settings and data are left where they are. Updating
  this way starts with the version after this one; the Electron build still links to the download
  page.
- **A new version extracted beside the old one keeps your settings.** If you update by hand and
  extract the new folder next to the previous one, it carries over your settings, overlay layout,
  timers and Companion data the first time it starts.

### Changed

- **Closing the launcher can keep the app running.** With "Minimize and close the launcher to the
  tray" turned on under Settings > General, the launcher's close button puts it in the tray instead
  of ending the app, so the overlay and its hotkeys keep working. Exit from the tray icon's menu.
  With the setting off, closing the launcher still ends the app, as before.

### Fixed

- **Pickup cards and target drops name stats as the game does**, such as Multistrike rather than
  Double Attack, so a target typed from the game's tooltip matches. A stat no item can have is
  shown in red in the target drops editor.
- **"Minimize launcher to tray" works** in the standard build. The minimise button ignored the
  setting and only minimised to the taskbar.
- **No overlay process is left behind when the app closes.** Closing the app with the Settings
  window open could leave a hidden overlay process running.
- **The killing blow is counted once** in the Damage taken total. It was added twice.

### Credits

- **Buh ([bjb2](https://github.com/bjb2))** wrote [Vale Companion](https://github.com/bjb2/valecompanion),
  which the Companion window is built on, agreed to have it brought into this app, and runs the
  market service its prices come from. Thank you, Buh.

### For developers

- Vale Companion's code lives in `packages/companion`, with a README listing what came from where
  and what was changed. Unlike Vale Companion itself, market contribution is opt-in here, and
  materials and consumables are given a market value.
- The Electron build includes the Companion too.

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
