---
name: Spirit Vale Overlay
description: A championship broadcast package for a passive Spirit Vale companion; scorebugs, stat bugs and lower-thirds read in a glance over any scene.
colors:
  ink: "#0c1218"
  paper: "#f4f7fa"
  paper-2: "rgba(244, 247, 250, .74)"
  paper-3: "rgba(244, 247, 250, .52)"
  rule: "rgba(244, 247, 250, .14)"
  stripe: "rgba(244, 247, 250, .045)"
  stripe-alt: "rgba(244, 247, 250, .075)"
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
---

# Design System: Spirit Vale Overlay

## Overview

**Creative North Star: "The Championship Broadcast Package"**

Every surface is a stream graphic: a scorebug, a stat bug, a standings table, a lower-third. Each is cut from a solid ink plate with one 45-degree corner clipped away, named by a small solid tag in the colour of the channel it speaks on, and filled with heavy condensed numerals over legible names. A viewer reads it the way they read a match: tag, number, order, then back to the action. The world deliberately refuses the dark, rounded, translucent meter-panel stack that DPS addons ship.

Density is high and flat. Plates carry no rounded corners, no gradients of tone, no glass. Data sits in alternating striped bands; meters are flat fills with a bright leading cap; time is drawn as length. Colour is a channel, never a decoration: teal is the broadcast's own voice, flame is threat, gold is loot and value, and five team colours say only who.

The in-game overlay (`packages/overlay`) is the first and only surface built in this world. The tool windows (launcher, Settings, Rewards, Combat, Boss Timers, Character, Build Export, Companion) still use the previous Material 3 dark-green theme in `packages/ui-kit/theme.css` and have not been migrated; they are planned to move into this world next. Until they do, this file describes the overlay's shipped system and the rules the windows should adopt, not the windows' current look.

**Key Characteristics:**
- Square ink plates, one corner cut, alpha set by the player's per-element opacity.
- Titles as solid channel-colour tags with a slanted trailing end.
- Barlow Condensed for every number and label; Atkinson Hyperlegible Next for names and sentences.
- Striped rows, flat fills with a bright cap, ten-segment gauges.
- Motion only on arrival: a lower-third wipe or a two-beat flash, then stillness.

## Colors

One near-black ink, one cool paper white in three strengths, and a small set of saturated broadcast channels, each owning one meaning.

### Primary
- **Broadcast Teal** (broadcast-teal): the broadcast's own voice. Default channel of every plate (title tag, top edge highlight, chart line), the lock button, edit-mode grid lines, range and checkbox accents, minimap north and player marker.

### Secondary
- **Threat Flame** (threat-flame): bosses, deaths, damage taken, kills, debuffs, expiring statuses, alerts, finished timers. The only colour allowed to flash.
- **Loot Gold** (loot-gold): gold, loot toasts, item counts, target drops, gear ratings and stars, boss timers, shields on the health bar, character XP, the boss "in window" state, and the active edit-grid toggle.

### Tertiary
- **XP Sky** (xp-sky): XP tracker, XP chart, job XP.
- **Summon Lime** (summon-lime): the summons plate, healthy summon gauges, items gained, the player's own boss kill check.
- **Artifact Violet** (artifact-violet): artifact pickups and the toggles plate, so artifacts are never confused with gear.
- **HP Red** (hp-red) and **MP Blue** (mp-blue): the health and mana resource bars only.
- **Team colours** (team-1 to team-5: Signal Blue, Hot Pink, Orchid, Tan, Indigo): one per player in rankings and boss meters, assigned per name and reused past the fifth player.

### Neutral
- **Plate Ink** (ink): every plate, frame and dark backing. Always applied as `rgb(12 18 24 / alpha)` so the player's opacity setting governs it (default .76; floating cards .86 to .97).
- **Paper** (paper): primary text and numbers, the stacks badge, the gear pickup slot tag, the edit-mode title badge.
- **Paper 2** (paper-2): secondary text, inspector body, rank numbers.
- **Paper 3** (paper-3): tertiary text, units, waiting and empty states, chart labels. The build uses this alpha white where the direction contract proposed a slate (#8C98A8); the alpha form is what shipped.
- **Rule** (rule): hairline dividers, chart grid, icon frame outlines.
- **Stripe / Stripe Alt** (stripe, stripe-alt): alternating row bands.

### Named Rules
**The Channel Rule.** Every plate speaks on exactly one channel, set once per element (`--channel`), and its tag, top edge, chart line, time bars and active tab all take that colour. Never mix two channels' tags on one plate.

**The Who-Only Rule.** Team colours say only which player a row is; they never mean threat, loot or value, and channel colours never fill a player's row.

**The Ink-On-Colour Rule.** Text set on a solid channel or team fill is ink and loses the text halo; text set on ink is paper and keeps it. User-chosen loot rule colours pick ink or white by luminance.

## Typography

**Display Font:** Barlow Condensed 600/700/800 (with Bahnschrift SemiCondensed, Arial Narrow)
**Body Font:** Atkinson Hyperlegible Next, variable 200-800 (with Segoe UI, system-ui)

**Character:** Broadcast numerals against a legibility face: the condensed cut carries every number, tag and label in tight uppercase; Atkinson carries the things people must not misread, player, item, skill and boss names. Both load with `font-display: block` and `font-synthesis: none`; all numbers are tabular.

### Hierarchy
- **Display** (800, 30px, line-height .95): the boss meter total and the personal DPS number. The personal number scales with its plate (`clamp(16px, 8.5cqw, 34px)`); clock and timer digits fill their tile through container units.
- **Headline** (800, 19-22px, line-height 1): secondary numbers in a scorebug, gear stat values, pickup count and refine level.
- **Title** (800, 13px, .08em, uppercase): the channel tag. Banners on lower-thirds step up to 15px at .12em.
- **Data** (700, 15-16px): row values (DPS, damage, timers, resource numbers). 600 weight for the de-emphasised half of a pair (max, rate, share).
- **Name** (Atkinson 700, 12-15px): player, skill, item and boss names, ellipsised on one line.
- **Body** (Atkinson 400, 11-12px, line-height 1.35): help text and stat labels, max 34rem.
- **Label** (Barlow 600-700, 12-13px, .04-.08em, uppercase): units, captions, empty and waiting states, column hints.

### Named Rules
**The Numbers-Are-Condensed Rule.** Every numeral is Barlow Condensed and tabular; every name is Atkinson. A number set in Atkinson or a name set in Barlow uppercase is wrong.

**The Halo Rule.** Paper text on a plate carries a tight two-layer ink halo (`0 0 2px` at .95, `0 1px 3px` at .85) so it survives any game scene at any plate opacity.

## Layout

Each overlay element is an independent, absolutely positioned plate the player drags and resizes on a 10px grid with 50px majors; nothing assumes a neighbour. Minimum plate size is 160 by 100px; thin strips (health, mana, XP, weight, clock, timer) go down to 24-40px tall. There are no viewport breakpoints: plates respond to their own size through container queries (`cqw`, `cqh`), and narrow plates wrap the number under its tag rather than clipping it.

Rhythm is a tight 2/4/6/8/10/12/16px set. Plate content pads 12px 12px 10px; a title tag sits 10px above its content; rows stack 2px apart (1px inside boss meters); row internal padding is 3px vertical. Tags and numbers share a baseline in a scorebug line, with 8px between them.

## Elevation & Depth

Plates are flat. Depth inside a plate comes from tone (ink under alternating stripes under flat fills) and from a single 1px inset top edge in the channel colour at 55%. Soft ambient shadow appears only on things that float above other plates: lower-third cards (`0 4px 14px` at .45), loot toasts, the edit-mode inspector and hint, and every plate while the overlay is unlocked for editing.

### Shadow Vocabulary
- **Channel edge** (`box-shadow: inset 0 1px 0 color-mix(in srgb, var(--channel) 55%, transparent)`): the top lip of every plate.
- **Lower-third lift** (`box-shadow: 0 4px 14px rgba(0, 0, 0, .45)`): pickup and drop cards.
- **Edit lift** (`box-shadow: 0 6px 24px rgba(0, 0, 0, .38)`): plates while editing.
- **Inspector** (`box-shadow: inset 0 2px 0 var(--teal), 0 10px 28px rgba(0, 0, 0, .45)`): the floating inspector.
- **Alarm frame** (`box-shadow: inset 0 0 0 3px var(--flame)`): a plate in a warning state (missing statuses, weight danger); gold for caution.

### Named Rules
**The Flat Plate Rule.** A plate at rest has no outer shadow; lift is reserved for cards that arrive over others and for edit mode.

## Shapes

Everything is square. The one curve in the system is the minimap radar, which is round because a radar is. Each plate loses its top-right corner to a 45-degree cut (10px, 6px on thin strips); alarm frames are clipped to the same silhouette. Tags, banners, timer modes and the lock button are parallelograms on their trailing edge only: a vertical leading side and a 5-8px slant out. Meter fills end in a 2-3px bright cap; resource and summon gauges are cut into ten segments by ink hairlines. Icons are drawn in one 2px square-capped, mitred stroke on a 16px grid and take the text colour; class, status and item icons are the game's own rasters, set in square frames with a 1px rule outline.

## Components

### Plate (Element Surface)
The container every element is drawn on.
- **Corner Style:** square, top-right cut (10px).
- **Background:** ink at the player's opacity (default .76).
- **Border:** none; the channel edge on top; alarm frames inset 3px.
- **Internal Padding:** 12px 12px 10px.
- **Edit mode:** dashed 1px outline in the channel tint; selected plates get a solid 2px channel outline offset 2px and L-shaped 3px corner resize handles.

### Title Tag
The element's name as a broadcast tag: solid channel fill, ink letters, 13px Barlow 800 at .08em, uppercase, 6px slanted end, no text halo. Variants by channel only. The boss meter's tag sits grey until a boss is engaged, then turns flame, followed by the boss name on a darker ink strip.

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

### Buttons and Tabs
- **Quiet button** (reset): stripe-alt fill, paper-2 condensed label; hover fills with the channel and turns ink.
- **Tabs** (boss timer regions): stripe-alt chips; active takes the channel fill; a gold or flame 2px underline marks a region whose boss is in window or overdue.
- **Lock pill** (edit mode): teal parallelogram, 15px Barlow 800 at .08em; hover mixes 18% white; focus is a 2px paper outline offset 2px. The grid toggle is the ink variant with a rule outline and turns gold when active.

### Inspector
Edit-mode floating panel: ink at .97, teal 2px top edge, condensed uppercase header that drags it, condensed values beside teal range sliders and checkboxes.

### Edit Grid
The construction grid is part of the drawing: teal 1px lines every 50px over faint paper lines every 10px, on a 34% ink scrim. Disabled elements show as gold hazard stripes on ink with their name in condensed uppercase.

## Do's and Don'ts

### Do:
- **Do** cut every plate from ink at the player's opacity, square with the top-right 45-degree cut (10px; 6px on thin strips).
- **Do** name every element with a solid channel tag, ink letters, slanted trailing end.
- **Do** set every number in Barlow Condensed, tabular; set every name in Atkinson Hyperlegible Next.
- **Do** draw time and share as length: fills, time bars and veils, not percentages alone.
- **Do** keep the two-layer ink halo on paper text over plates, and drop it on solid colour fills.
- **Do** animate only on arrival: one lower-third wipe or a two-beat flash that then holds; honour `prefers-reduced-motion` by showing the end state.

### Don't:
- **Don't** round corners; the minimap radar is the only circle.
- **Don't** use smooth tonal gradients or glass blur on plates; repeating gradients are for stripes, segments and hazard bands only.
- **Don't** loop any animation during play; nothing keeps blinking during a fight.
- **Don't** use a team colour to mean anything but who, or a channel colour to fill a player's row.
- **Don't** use text glyphs or emoji as icons; draw them as 2px square-capped strokes on the 16px grid, or use the game's own rasters.
- **Don't** add hard offset shadows; lift is soft and ambient, and only for floating cards and edit mode.
