---
name: Spirit Vale Overlay
description: A championship broadcast package for a passive Spirit Vale companion; scorebugs, stat bugs and lower-thirds read in a glance over any scene, and the tool windows are the studio desk behind them.
colors:
  ink: "#0c1218"
  ink-deep: "#080c10"
  plate: "#121a22"
  plate-raised: "#19232d"
  plate-high: "#212c37"
  paper: "#f4f7fa"
  paper-2: "rgba(244, 247, 250, .74)"
  paper-3: "rgba(244, 247, 250, .52)"
  window-paper-3: "rgba(244, 247, 250, .55)"
  rule: "rgba(244, 247, 250, .14)"
  rule-strong: "rgba(244, 247, 250, .3)"
  stripe: "rgba(244, 247, 250, .045)"
  stripe-alt: "rgba(244, 247, 250, .075)"
  window-stripe: "rgba(244, 247, 250, .035)"
  window-stripe-alt: "rgba(244, 247, 250, .07)"
  broadcast-teal: "#00c2a8"
  threat-flame: "#ff5a36"
  loot-gold: "#ffc145"
  xp-sky: "#4fd1ff"
  summon-lime: "#8bd450"
  artifact-violet: "#9b6cff"
  hp-red: "#e5484d"
  mp-blue: "#2f6fe0"
  team-1: "#3d8bff"
  team-2: "#ff4f8b"
  team-3: "#e04ef0"
  team-4: "#c49a6c"
  team-5: "#5a5cf2"
  rarity-common: "#f2f2f2"
  rarity-rare: "#2ecc71"
  rarity-epic: "#a35bff"
  warning-text: "#ffe9b8"
  error-text: "#ffd9cf"
typography:
  display:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: ".01em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: ".01em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: ".08em"
  data:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "\"tnum\""
  body:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.35
  name:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: ".06em"
  window-display:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "26px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: ".01em"
    fontFeature: "\"tnum\""
  window-heading:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: ".04em"
  window-total:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: ".01em"
    fontFeature: "\"tnum\""
  window-tag:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "14px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: ".08em"
  window-row:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "\"tnum\""
  window-control:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: ".06em"
  window-name:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
  window-body:
    fontFamily: "Atkinson Hyperlegible Next, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
  window-label:
    fontFamily: "Barlow Condensed, Bahnschrift SemiCondensed, Arial Narrow, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: ".07em"
rounded:
  none: "0px"
  radar: "50%"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  plate: "12px"
  window: "14px"
  xl: "16px"
components:
  plate:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 12px 10px"
  title-tag:
    backgroundColor: "{colors.broadcast-teal}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.none}"
    padding: "3px 12px 2px 7px"
  title-tag-threat:
    backgroundColor: "{colors.threat-flame}"
    textColor: "{colors.ink}"
  title-tag-loot:
    backgroundColor: "{colors.loot-gold}"
    textColor: "{colors.ink}"
  ranking-row:
    backgroundColor: "{colors.stripe}"
    textColor: "{colors.paper}"
    typography: "{typography.name}"
    height: "30px"
    padding: "3px 8px 3px 4px"
  ranking-row-even:
    backgroundColor: "{colors.stripe-alt}"
  detail-row:
    backgroundColor: "{colors.stripe}"
    height: "26px"
    padding: "3px 8px 3px 6px"
  resource-bar-health:
    backgroundColor: "{colors.hp-red}"
    textColor: "{colors.paper}"
    typography: "{typography.data}"
    padding: "0 8px"
  resource-bar-mana:
    backgroundColor: "{colors.mp-blue}"
    textColor: "{colors.paper}"
  status-frame:
    backgroundColor: "{colors.ink}"
    size: "36px"
  stacks-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "0 3px"
  lower-third-card:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    padding: "10px 12px 11px"
  lower-third-banner:
    backgroundColor: "{colors.loot-gold}"
    textColor: "{colors.ink}"
    padding: "4px 16px 3px 10px"
  slot-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    padding: "2px 10px 1px 6px"
  quiet-button:
    backgroundColor: "{colors.stripe-alt}"
    textColor: "{colors.paper-2}"
    typography: "{typography.label}"
    padding: "2px 9px 1px"
  quiet-button-hover:
    backgroundColor: "{colors.broadcast-teal}"
    textColor: "{colors.ink}"
  tab-active:
    backgroundColor: "{colors.loot-gold}"
    textColor: "{colors.ink}"
  lock-pill:
    backgroundColor: "{colors.broadcast-teal}"
    textColor: "{colors.ink}"
    padding: "9px 18px 8px"
  inspector-panel:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-2}"
    width: "260px"
    padding: "10px 12px 12px"
  window-titlebar:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.paper}"
    height: "40px"
    padding: "0 0 0 12px"
  window-plate:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 12px 14px"
  window-button:
    backgroundColor: "{colors.window-stripe-alt}"
    textColor: "{colors.paper}"
    typography: "{typography.window-control}"
    rounded: "{rounded.none}"
    height: "32px"
    padding: "1px 14px 0"
  window-button-hover:
    backgroundColor: "{colors.rule}"
  window-button-primary:
    backgroundColor: "{colors.broadcast-teal}"
    textColor: "{colors.ink}"
    height: "32px"
    padding: "1px 18px 0 14px"
  window-button-ghost:
    textColor: "{colors.paper-2}"
  seg-chip:
    backgroundColor: "{colors.window-stripe-alt}"
    textColor: "{colors.paper-2}"
    typography: "{typography.window-control}"
    padding: "6px 14px 5px"
  seg-chip-active:
    backgroundColor: "{colors.broadcast-teal}"
    textColor: "{colors.ink}"
  pill:
    backgroundColor: "{colors.window-stripe-alt}"
    textColor: "{colors.paper-2}"
    typography: "{typography.window-label}"
    padding: "2px 8px 1px"
  stat-tile:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    typography: "{typography.window-display}"
    padding: "10px 12px 11px"
  data-table-row:
    backgroundColor: "{colors.window-stripe}"
    textColor: "{colors.paper}"
    typography: "{typography.window-row}"
    padding: "6px 10px"
  data-table-row-even:
    backgroundColor: "{colors.window-stripe-alt}"
  data-table-head:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.window-paper-3}"
    typography: "{typography.window-label}"
    padding: "6px 10px"
  input-well:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "7px 10px"
  banner:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper-2}"
    padding: "9px 12px"
  dialog:
    backgroundColor: "{colors.plate-raised}"
    textColor: "{colors.paper}"
    width: "520px"
    padding: "16px 18px 18px"
  popover:
    backgroundColor: "{colors.plate-high}"
    textColor: "{colors.paper}"
    padding: "4px"
  tool-tile:
    backgroundColor: "{colors.plate}"
    textColor: "{colors.paper}"
    typography: "{typography.window-heading}"
    padding: "14px 12px 12px"
---

# Design System: Spirit Vale Overlay

## Overview

**Creative North Star: "The Championship Broadcast Package"**

Every surface is a stream graphic: a scorebug, a stat bug, a standings table, a lower-third. Each is cut from a solid ink plate with one 45-degree corner clipped away, named by a small solid tag in the colour of the channel it speaks on, and filled with heavy condensed numerals over legible names. A viewer reads it the way they read a match: tag, number, order, then back to the action. The world deliberately refuses the dark, rounded, translucent meter-panel stack that DPS addons ship.

Density is high and flat. Plates carry no rounded corners, no gradients of tone, no glass. Data sits in alternating striped bands; meters are flat fills with a bright leading cap; time is drawn as length. Colour is a channel, never a decoration: teal is the broadcast's own voice, flame is threat, gold is loot and value, and five team colours say only who.

The world has two surfaces. The in-game overlay (`packages/overlay`) is the on-air package: translucent ink plates over the game scene, sized and placed by the player. The tool windows (launcher, Settings, Combat with its analysis detail, death log and session picker, Rewards with its catalog, Character, Boss Timers, Build Export, and the Companion window's chrome) are the studio desk behind it: the same plates, tags, stripes and faces, set opaque on a stepped ink desk from the shared window theme (`packages/ui-kit/theme.css`), with a larger type ramp for reading at a desk. Each window speaks on one tool channel, set on `:root`. The Companion window's inner pages are Buh's Vale Companion, a credited third-party app; only its base colours and interface face are mapped onto this palette, and its layout and components are not part of this system.

**Key Characteristics:**
- Square ink plates, one corner cut; on the overlay, alpha set by the player's per-element opacity; in the windows, opaque steps of the desk.
- Titles as solid channel-colour tags with a slanted trailing end.
- Barlow Condensed for every number and label; Atkinson Hyperlegible Next for names and sentences.
- Striped rows, flat fills with a bright cap, ten-segment gauges.
- One channel per tool window, carried by the titlebar underline, tags, plate lips, active chips, focus and charts.
- Motion only on arrival: a lower-third wipe or a two-beat flash, then stillness.

## Colors

One near-black ink stepped into a desk, one cool paper white in three strengths, and a small set of saturated broadcast channels, each owning one meaning.

### Primary
- **Broadcast Teal** (broadcast-teal): the broadcast's own voice. Default channel of every overlay plate (title tag, top edge highlight, chart line), the lock button, edit-mode grid lines, minimap north and player marker. In the windows it is the channel of the launcher, Combat, its analysis detail and the session picker, and the launcher's overlay timer panel.

### Secondary
- **Threat Flame** (threat-flame): bosses, deaths, damage taken, kills, debuffs, expiring statuses, alerts, finished timers, error banners, and every window close button on hover. The only colour allowed to flash. Channel of the Boss Timers and death log windows.
- **Loot Gold** (loot-gold): gold, loot toasts, item counts, target drops, gear ratings and stars, boss timers, shields on the health bar, character XP, the boss "in window" state, warning banners and the update action. Channel of the Rewards and catalog windows.

### Tertiary
- **XP Sky** (xp-sky): XP tracker, XP chart, job XP; channel of the Character window.
- **Summon Lime** (summon-lime): the summons plate, healthy summon gauges, items gained, the player's own boss kill check, the "ok" status square; channel of the Build Export window.
- **Artifact Violet** (artifact-violet): artifact pickups and the toggles plate, so artifacts are never confused with gear; channel of the Companion window.
- **HP Red** (hp-red) and **MP Blue** (mp-blue): the health and mana resource bars only.
- **Team colours** (team-1 to team-5: Signal Blue, Hot Pink, Orchid, Tan, Indigo): one per player in rankings and boss meters, assigned per name and reused past the fifth player.
- **Warning Text / Error Text** (warning-text, error-text): pale gold and pale flame text on the window theme's warning and error bands (gold or flame mixed 16-20% into plate), so banner copy stays legible on its tint.
- **Rarity colours** (rarity-common, rarity-rare, rarity-epic): the game's own item rarity colours, used only as the small square before a drop or item name.

### Neutral
- **Plate Ink** (ink): every overlay plate, frame and dark backing, always applied as `rgb(12 18 24 / alpha)` so the player's opacity setting governs it (default .76; floating cards .86 to .97). In the windows it is the window background.
- **Deep Ink** (ink-deep): the window desk's lowest step: titlebar strip, table header row, input wells, the Settings section rundown.
- **Plate / Plate Raised / Plate High** (plate, plate-raised, plate-high): the window desk's three raised steps. Plate for cards, stat tiles, tables and tool tiles; raised for dialogs, expanded table detail and cards inside cards; high for menus, popovers, tooltips and select options.
- **Paper** (paper): primary text and numbers, the stacks badge, the gear pickup slot tag, the edit-mode title badge, keyboard keys, and the Settings window's channel.
- **Paper 2** (paper-2): secondary text, inspector body, rank numbers, resting button labels.
- **Paper 3** (paper-3 on the overlay, window-paper-3 in the windows): tertiary text, units, waiting and empty states, chart and column labels. The overlay keeps .52; the window theme lifts it to .55 for desk reading distance.
- **Rule / Rule Strong** (rule, rule-strong): hairline dividers, chart grid and icon frames; the strong rule is the window outline, checkbox well, range track and scrollbar thumb.
- **Stripe / Stripe Alt**: alternating row bands. The overlay draws them at .045 and .075 (the .075 is written inline in the overlay stylesheet, not as a property); the windows at .035 and .07 (window-stripe, window-stripe-alt), which also fill resting buttons, chips and pills.

### Named Rules
**The Channel Rule.** Every plate speaks on exactly one channel, set once per element (`--channel`), and its tag, top edge, chart line, time bars and active tab all take that colour. Never mix two channels' tags on one plate.

**The One-Tool-One-Channel Rule.** Each window sets its tool's channel on `:root` (launcher, Combat, analysis detail and session picker teal; Rewards and catalog gold; Character sky; Boss Timers and death log flame; Build Export lime; Companion violet; Settings paper), and each launcher tile takes the channel of the tool it opens. A window's titlebar underline, brand tag, primary button, active chips, focus outline, selection and charts all follow it; state colours (flame error, gold warning, lime ok) stay fixed.

**The Who-Only Rule.** Team colours say only which player a row is; they never mean threat, loot or value, and channel colours never fill a player's row.

**The Ink-On-Colour Rule.** Text set on a solid channel or team fill is ink and loses the text halo; text set on ink is paper and keeps it. User-chosen loot rule colours pick ink or white by luminance.

## Typography

**Display Font:** Barlow Condensed 600/700/800 (with Bahnschrift SemiCondensed, Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next, variable 200-800 (with Segoe UI, system-ui)

**Character:** Broadcast numerals against a legibility face: the condensed cut carries every number, tag and label in tight uppercase; Atkinson carries the things people must not misread, player, item, skill and boss names. Both load with `font-display: block` and `font-synthesis: none`; all numbers are tabular.

### Hierarchy (overlay)
- **Display** (800, 30px, line-height .95): the boss meter total and the personal DPS number. The personal number scales with its plate (`clamp(16px, 8.5cqw, 34px)`); clock and timer digits fill their tile through container units.
- **Headline** (800, 19-22px, line-height 1): secondary numbers in a scorebug, gear stat values, pickup count and refine level.
- **Title** (800, 13px, .08em, uppercase): the channel tag. Banners on lower-thirds step up to 15px at .12em.
- **Data** (700, 15-16px): row values (DPS, damage, timers, resource numbers). 600 weight for the de-emphasised half of a pair (max, rate, share).
- **Name** (Atkinson 700, 12-15px): player, skill, item and boss names, ellipsised on one line.
- **Body** (Atkinson 400, 11-12px, line-height 1.35): help text and stat labels, max 34rem.
- **Label** (Barlow 600-700, 12-13px, .04-.08em, uppercase): units, captions, empty and waiting states, column hints.

### Hierarchy (windows)
The windows read at a desk, not over a fight, so their ramp sits one step larger than the overlay's. These sizes are the window ramp, not drift.
- **Window Display** (Barlow 800, 26px, .01em): stat tile numbers.
- **Window Heading** (Barlow 800, 20-22px, .03-.04em, uppercase): window and dialog headings (22px), launcher tile and timer panel names and Settings section titles (20px). A heading that is a name (the character, a player in analysis detail, a boss fight) is Atkinson 800 at 20-26px instead, mixed case.
- **Window Total** (Barlow 800, 18-22px): summary totals over tables (22px; 18px inside boss fight detail and Rewards totals), item counter values, attribute and progression numbers.
- **Window Tag** (Barlow 800, 14px, .08em, uppercase): section heads drawn as channel tags inside a window (the shared tag and the titlebar brand tag stay 13px).
- **Window Row** (Barlow 600-700, 15px): table cells and row values; Boss Timers place and countdown step up to 15px and 17px; number inputs 14px.
- **Window Control** (Barlow 700, 13px, .06em, uppercase): buttons and segmented chips; primary buttons 800. The Settings rundown sets 15px.
- **Window Name** (Atkinson 700, 13px): name cells and row headers in tables, ellipsised at 220px.
- **Window Body** (Atkinson 400, 13px root; 12px for help, banners and descriptions at line-height 1.4-1.45).
- **Window Label** (Barlow 700, 12px, .07em, uppercase, window-paper-3): column heads, field labels, stat tile captions, chart axes.

### Named Rules
**The Numbers-Are-Condensed Rule.** Every numeral is Barlow Condensed and tabular; every name is Atkinson. A number set in Atkinson or a name set in Barlow uppercase is wrong.

**The Halo Rule.** Paper text on an overlay plate carries a tight two-layer ink halo (`0 0 2px` at .95, `0 1px 3px` at .85) so it survives any game scene at any plate opacity. Window text sits on opaque ink and goes without, except over a share fill (the Combat meter rows keep a lighter halo).

## Layout

Each overlay element is an independent, absolutely positioned plate the player drags and resizes on a 10px grid with 50px majors; nothing assumes a neighbour. Minimum plate size is 160 by 100px; thin strips (health, mana, XP, weight, clock, timer) go down to 24-40px tall. There are no viewport breakpoints: plates respond to their own size through container queries (`cqw`, `cqh`), and narrow plates wrap the number under its tag rather than clipping it.

Rhythm is a tight 2/4/6/8/10/12/16px set. Plate content pads 12px 12px 10px; a title tag sits 10px above its content; rows stack 2px apart (1px inside boss meters); row internal padding is 3px vertical. Tags and numbers share a baseline in a scorebug line, with 8px between them.

The windows are frameless: a 40px titlebar strip over a content area that pads 14px 16px (Settings content 14px 18px, beside a 160px section rundown). Every window declares a minimum size (from 560 by 420px for Settings up to 820 by 560px for Build Export) instead of reflowing below it. Parts of one group butt together with a 2px gap (segmented chips, stat tiles, table rows, drop chips, tally cells); separate plates sit 8-12px apart. The launcher is a five-column board of tool tiles at an 8px gap, each at least 92px tall, with the overlay timer panel spanning three columns.

## Elevation & Depth

Plates are flat. Depth inside a plate comes from tone (ink under alternating stripes under flat fills) and from a single 1px inset top edge in the channel colour at 55%. On the overlay, soft ambient shadow appears only on things that float above other plates: lower-third cards, loot toasts, the edit-mode inspector and hint, and every plate while the overlay is unlocked for editing. In the windows, depth is the desk's tonal steps (ink-deep, ink, plate, plate-raised, plate-high); the only outer shadows belong to things that float over the window: dialogs, menus, popovers, the calendar and chart tooltips.

### Shadow Vocabulary
- **Channel edge** (`box-shadow: inset 0 1px 0 color-mix(in srgb, var(--channel) 55%, transparent)`): the top lip of every plate and stat tile.
- **Channel lip** (`box-shadow: inset 0 2px 0 var(--channel)`): the 2px top edge of floating parts (inspector, dialogs, menus, tooltips), launcher tiles and banners (in the rule-strong, channel, gold or flame colour by kind).
- **Channel underline** (`box-shadow: inset 0 -2px 0 var(--channel)`): the titlebar strip, an active non-primary button, a selected row or option, an expanded table row, and focused input wells (with an inset 1px channel ring).
- **Lower-third lift** (`box-shadow: 0 4px 14px rgba(0, 0, 0, .45)`): pickup and drop cards.
- **Edit lift** (`box-shadow: 0 6px 24px rgba(0, 0, 0, .38)`): plates while editing.
- **Inspector** (`box-shadow: inset 0 2px 0 var(--teal), 0 10px 28px rgba(0, 0, 0, .45)`): the floating inspector.
- **Window lift** (`box-shadow: inset 0 2px 0 var(--channel), 0 12px 32px rgb(12 18 24 / .7)`): dialogs; menus and popovers use `0 10px 28px` at .7, chart tooltips `0 8px 22px` at .6.
- **Alarm frame** (`box-shadow: inset 0 0 0 3px var(--flame)`): an overlay plate in a warning state (missing statuses, weight danger); gold for caution.

### Named Rules
**The Flat Plate Rule.** A plate at rest has no outer shadow; lift is reserved for cards that arrive over others, for edit mode, and for dialogs and menus that float over a window.

**The Lip-Not-Border Rule.** Edges are drawn as inset lips, rings and underlines in the channel or rule colour, never as outer borders; the window outline itself is an inset 1px rule.

## Shapes

Everything is square. The one curve in the system is the minimap radar, which is round because a radar is. Each plate loses its top-right corner to a 45-degree cut (10px, 6px on thin strips, 14px on dialogs); alarm frames are clipped to the same silhouette. Tags, banners, timer modes, the lock button, primary window buttons, the update action and the active Settings section are parallelograms on their trailing edge only: a vertical leading side and a 5-8px slant out. Meter fills end in a 2-3px bright cap; resource and summon gauges are cut into ten segments by ink hairlines. Window controls stay in the geometry: checkboxes are 16px square wells, radios are diamonds, range thumbs are 10 by 18px bars on a 4px track, status marks are 9px squares, scrollbars are square rule-coloured bars. Icons are drawn in one 2px square-capped, mitred stroke on a 16px grid and take the text colour and size (the window set lives in `packages/ui-kit/icons.tsx`; the select chevron and checkbox tick use the same stroke); class, status and item icons are the game's own rasters, set in square frames with a 1px rule outline.

## Components

### Plate (Element Surface)
The container every overlay element is drawn on.
- **Corner Style:** square, top-right cut (10px).
- **Background:** ink at the player's opacity (default .76).
- **Border:** none; the channel edge on top; alarm frames inset 3px.
- **Internal Padding:** 12px 12px 10px.
- **Edit mode:** dashed 1px outline in the channel tint; selected plates get a solid 2px channel outline offset 2px and L-shaped 3px corner resize handles.

### Title Tag
The element's name as a broadcast tag: solid channel fill, ink letters, 13px Barlow 800 at .08em, uppercase, 6px slanted end, no text halo. Variants by channel only. The boss meter's tag sits grey until a boss is engaged, then turns flame, followed by the boss name on a darker ink strip. In the windows, section heads take the same tag at 14px.

### Scorebug
Tag and display number on one baseline (personal DPS, boss total, gold and XP totals), with a row of headline numbers underneath, each number followed by its condensed uppercase label. The unit is implied by the tag and kept for assistive tech only.

### Ranking and Detail Rows
Striped bands (alternating stripe and stripe-alt), 30px tall (26px for detail lists, 24px inside boss meters). A flat fill grows from the left to the row's share, team colour at 52% for players or the channel at 34% for detail lists, ending in a bright 2px cap. Rank numeral, class icon in a square frame, Atkinson name, condensed value right-aligned. Secondary text over a fill is tinted from that fill, not greyed.

### Resource Bars
Health, mana, character XP and job XP as thin strips: a flat fill at 78% with a 3px bright cap, ten ink-hairline segments, the condensed label on the left and current/max on the right. Shield fills in gold from the right edge. Fill changes ease linearly over 120ms.

### Status Icons
36px square frames (22px inside summons) with the game's icon, an ink veil that drops from the top as time runs out, a white stacks badge in the corner, a 3px channel time bar and the seconds left underneath. Expiring statuses get a 2px flame frame that flashes twice and holds.

### Lower-Thirds (Pickups, Target Drops, Loot Toasts)
Cards on high-opacity ink that wipe in from their tag outward (`clip-path` reveal, .26-.32s on the out-expo ease), once per event. Target drops lead with a 15px banner in the rule colour; gear cards carry a white slot tag, artifacts a violet one; loot toasts carry a rarity square and a rarity tag.

### Overlay Buttons and Tabs
- **Quiet button** (reset): stripe-alt fill, paper-2 condensed label; hover fills with the channel and turns ink.
- **Tabs** (boss timer regions): stripe-alt chips; active takes the channel fill; a gold or flame 2px underline marks a region whose boss is in window or overdue.
- **Lock pill** (edit mode): teal parallelogram, 15px Barlow 800 at .08em; hover mixes 18% white; focus is a 2px paper outline offset 2px. The grid toggle is the ink variant with a rule outline and turns gold when active.

### Inspector
Edit-mode floating panel: ink at .97, teal 2px top edge, condensed uppercase header that drags it, condensed values beside range sliders and checkboxes. The overlay also links the window theme, so the inspector's checkboxes and ranges are the theme's square wells and bar thumbs in the channel.

### Edit Grid
The construction grid is part of the drawing: teal 1px lines every 50px over faint paper lines every 10px, on a 34% ink scrim. Disabled elements show as gold hazard stripes on ink with their name in condensed uppercase.

### Window Titlebar
The broadcast's top strip: 40px of deep ink with a 2px channel underline. The app icon, the window name in Barlow 800 at 15px uppercase, and a brand tag in the channel (13px, slanted end) carrying the tool name or a live count ("6 OF 11 UP"). Icon buttons on the right are 40px wide, paper-2 drawn icons; hover lifts to stripe-alt and paper, an active toggle (pin) fills with the channel, close turns flame with ink.

### Window Buttons
- **Shape:** square, 32px tall (no radius).
- **Default:** window-stripe-alt fill, paper Barlow 700 at 13px, .06em, uppercase, padding 1px 14px 0; hover rule, press rule-strong; disabled stripe with paper-3.
- **Primary:** solid channel fill, ink letters at 800, a 7px slanted trailing end and 18px right padding; hover mixes 18% paper in, press 14% ink. One per group.
- **Ghost:** transparent, paper-2; hover stripe-alt and paper.
- **Active toggle:** the channel mixed 16% into plate-raised with a 2px channel underline.
- **Focus:** 2px channel outline offset 2px on every control.

### Segmented Chips
Joined square chips at a 2px gap, window-stripe-alt with paper-2 Barlow 700 at 13px uppercase; hover rule and paper; the active chip is a solid channel fill with ink letters. Used for view switches (Live / Past log / Boss fight analysis), stat scopes and timer modes. **Pills** and **chips** are the static cousin: window-stripe-alt, paper-2, 12px Barlow 700 uppercase, padding 2px 8px 1px.

### Stat Tiles
Scorebugs on the desk: plate fill with the channel edge, the 26px Barlow 800 number above its 12px window label, padding 10px 12px 11px, joined at 2px. Summary tables over a data table use the same idea at 18-22px with the header and stripes removed.

### Data Tables
Striped bands on a plate: window-stripe and window-stripe-alt rows, cells 6px 10px, values right-aligned in Barlow 600 at 15px, the first column left. Name cells and row headers are Atkinson 700 at 13px, ellipsised at 220px. The sticky header is deep ink with window labels and a 1px rule underline; sort buttons show a drawn wedge that turns channel when active. Hover mixes 10% channel into plate. Expanded detail rows sit on plate-raised in body type. Combat's meter rows add a share fill with a 2px bright cap behind the row.

### Banners
A band with a 2px top lip: plate fill with a rule-strong lip by default; info mixes 12% channel with a channel lip and a solid channel action; warning is gold-tinted with a gold lip; error is flame-tinted with a flame lip. A 9px square status mark or a title in Barlow 800 leads; the action button sits at the right.

### Inputs / Fields
- **Style:** square wells of deep ink with an inset 1px rule ring, padding 7px 10px; number inputs in Barlow 600 at 14px.
- **Hover / Focus:** hover strengthens the ring to rule-strong; focus turns the ring channel and adds a 2px channel underline instead of an outline.
- **Disabled:** stripe fill, paper-3 text.
- **Selects:** native selects take the same well with the drawn 2px chevron; option lists and the custom select open as plate-high menus with a channel lip, the active option filled with the channel.
- **Checkboxes, radios, ranges:** 16px square wells (radio a diamond) that fill with the channel and an ink tick; ranges are a 4px rule-strong track with a 10 by 18px channel bar thumb.

### Dialogs and Menus
Dialogs are lifted plates: plate-raised, channel lip, window lift, a 14px corner cut, padding 16px 18px 18px over a .72 ink scrim, a 20px Barlow 800 uppercase heading and a close button that turns flame. Menus, multi-selects, the calendar and tooltips are plate-high with the channel lip and a smaller lift.

### Launcher Tool Board
One tile per tool, each in its own channel: plate with a 2px channel lip and the 10px corner cut, the tool name in Window Heading at 20px and a 12px paper-2 description. Hover mixes 16% channel into the plate and turns the name to the channel; press 24%.

### Boss Timer Rows
The respawn board as a striped table at 2px row spacing. Boss name in Atkinson, place in Barlow 15px, countdown in Barlow 800 at 17px, and under it the wait or the open window left drawn as a 3px bar (up to 160px, rule track, paper-2 fill scaled to the time left, gold in window). A boss in its window tints the row 12% gold with a gold underline and gold countdown; an overdue boss does the same in flame.

### Trend Charts
Drawn in the channel: a 2px square-capped, mitred line over a 14% channel area, rule grid lines, paper-3 Barlow axis labels at 12px, a dashed paper-3 crosshair, channel markers ringed in ink, and a plate-high tooltip with the channel lip.

### Companion Pages (boundary)
The Companion window's frame (titlebar, loading state) is ours, on the violet channel. The pages inside are Buh's Vale Companion, kept as published and credited: only its `:root` base colours (bg, panel, slot, sunk, lines, text strengths, gold, bad, warn, ok) and its interface face (Atkinson) are mapped onto this palette. Its layout, components and type are Buh's and are not part of this system; do not copy them into our windows or treat them as precedent.

## Do's and Don'ts

### Do:
- **Do** cut every plate from ink at the player's opacity, square with the top-right 45-degree cut (10px; 6px on thin strips).
- **Do** name every element with a solid channel tag, ink letters, slanted trailing end.
- **Do** set every number in Barlow Condensed, tabular; set every name in Atkinson Hyperlegible Next.
- **Do** draw time and share as length: fills, time bars and veils, not percentages alone.
- **Do** keep the two-layer ink halo on paper text over plates, and drop it on solid colour fills.
- **Do** animate only on arrival: one lower-third wipe or a two-beat flash that then holds; honour `prefers-reduced-motion` by showing the end state.
- **Do** set a new window's tool channel once on `:root` and build it from the shared theme's tokens and components; no raw hex outside `packages/ui-kit/theme.css`.
- **Do** use the window ramp (20-22px headings, 18-22px totals, 15px row values, 12px labels) in windows and the overlay ramp on the overlay.
- **Do** draw window icons from `packages/ui-kit/icons.tsx`: 2px square-capped strokes on the 16px grid in the text colour.

### Don't:
- **Don't** round corners; the minimap radar is the only circle.
- **Don't** use smooth tonal gradients or glass blur on plates; repeating gradients are for stripes, segments, empty states and hazard bands only.
- **Don't** loop any animation during play; nothing keeps blinking during a fight.
- **Don't** use a team colour to mean anything but who, or a channel colour to fill a player's row.
- **Don't** use text glyphs or emoji as icons; draw them as 2px square-capped strokes on the 16px grid, or use the game's own rasters.
- **Don't** add hard offset shadows; lift is soft and ambient, and only for floating cards, edit mode, and dialogs and menus.
- **Don't** take the Companion pages' layout, eyebrows or components as a pattern for our windows; they are Buh's.
