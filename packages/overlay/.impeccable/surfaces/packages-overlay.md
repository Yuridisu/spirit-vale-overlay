---
version: 1
slug: "packages-overlay"
primary_target: "packages/overlay"
related_targets: []
---

## Scope

The in-game overlay of Spirit Vale Overlay (packages/overlay overlayview): every element drawn over the game. Mode: Operate. First proof of the app-wide visual world; the tool windows follow in the same world.

## Audience, job, constraints

Spirit Vale players mid-fight, farming, or boss hunting; they read an element in a glance and look back at the game. Must not distract from the fight, must not look like a generic dashboard, must not show less information than before. Each element sits alone anywhere on screen, at the player's chosen size and opacity, over bright towns, dark dungeons and effect-heavy boss fights.

## Direction contract

THESIS: The overlay as a championship broadcast package: every element is a stream graphic (scorebug, stat bug, lower-third) cut from solid ink plates and read in a glance over any scene. It refuses the dark rounded meter-panel stack every DPS addon ships.

OWN-WORLD: Square ink plates (#0C1218) with one 45-degree corner cut, titles set in a small solid tag of the element's channel colour, striped data bands, heavy condensed numerals (Barlow Condensed) over Atkinson Hyperlegible names. Channels: teal #00C2A8 for the broadcast's own voice, flame #FF5A36 for threat (bosses, deaths, warnings), gold #FFC145 for loot and value, white #F4F7FA, slate #8C98A8 secondary. Meter fills are flat team colours with a bright leading cap.

STORY: The player sees their number, their party's order, what hit them and what dropped, the way a viewer reads a match: tag, number, ranking, then back to the action.

FIRST VIEWPORT: Top-left a DPS scorebug, the number at 30px beside a teal tag; under it the party table in striped bands with class icons; buff icons in a strip with time-length bars; a flame BOSS scorebug when a boss is engaged; pickups and drops wiping in as lower-thirds near the bottom.

FORM: Esports broadcast graphics, my first-ranked candidate (IMPECCABLE'S PICK), seed dbb33d87. Signature motion: new cards wipe in like a lower-third, a clip-path reveal from the tag outward, once per event; nothing loops.

Raises kept: duration as exact bar length (labanotation); one colour per tool for the windows (manual tab board); the construction grid visible in edit mode (Crouwel); the party as a fixed roster with name plates (character catalog).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
