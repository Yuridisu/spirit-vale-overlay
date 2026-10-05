# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The app is a Windows desktop program whose windows are web views: Neutralino (WebView2) by default, with an Electron build of the same views. Its interfaces are written as web pages (Preact, CSS) and must render the same in both shells.

## Users

Players of Spirit Vale, an online action RPG, on Windows PCs. The community is international and English-speaking; the maintainer is Brazilian. They use the app while playing: the overlay sits on top of the game during fights, farming and boss hunts, and the tool windows are opened between fights or on a second screen to look at results, set things up, or read the market. Groups include support players (healers), summoners, damage dealers, and players farming specific drops or running the Eternal Tower.

## Product Purpose

A passive companion for Spirit Vale. It reads the game's network traffic through Npcap, never sending, changing or injecting anything, and turns it into live combat meters, boss fight records, reward and drop tracking, character and build information, boss respawn timers, loot alerts, and an in-game overlay of small elements the player places where they want. Success is a player who keeps it open the whole session because it tells them, at a glance and without getting in the way, what is happening in their fight and their farm.

## Positioning

It works from the game's own traffic, so everything it shows is what the game itself reported, for the player and the party around them, without reading the screen or touching the game. Since 0.10.12 it also includes Vale Companion by Buh (bjb2): bag and storage with rolls and market value, loot rules, gold sessions, and the community market.

## Operating Context

- Played on PCs of every size, including ultrawide monitors (the maintainer plays at 2560x1080). The overlay is a transparent, click-through layer over the whole game screen; the player unlocks it (F1 by default) to drag, resize and toggle its elements, then locks it again.
- Overlay elements must stay readable over any game scene (bright towns, dark dungeons, effect-heavy boss fights) without hiding the game; each has its own opacity setting.
- Hotkeys (rebindable) drive the overlay without leaving the game.
- Tool windows: the launcher (entry point, capture status, tiles for every tool), Settings, Combat (live DPS, past logs, boss fight analysis), Rewards (summary, recent kills, trends, session tracker, item counter, target drops), Character, Boss Timers, Build Export, Companion, Manage Settings, and a live death log.
- The app can live in the system tray; closing the launcher can keep it running.
- Releases are portable ZIPs on GitHub; the app updates itself from inside.

## Capabilities and Constraints

- Everything is passive packet capture; the app must never claim to automate, bot, or alter the game.
- English is the only shipped locale today; all text goes through the i18n catalog (`packages/i18n/locales/en.ts`).
- Views are plain Preact with CSS files per view and a shared theme in `packages/ui-kit/theme.css`; there is no CSS framework. Assets (class icons, status icons, item icons) are bundled locally; the app works offline apart from update checks and the opt-in market service.
- The overlay surfaces are transparent windows pinned over each display; their elements draw their own backgrounds.
- The Companion window's pages come from Vale Companion (AGPL-3.0-or-later) and are served locally inside an iframe.

## Brand Commitments

- The name stays "Spirit Vale Overlay".
- The purple eggplant icon (`apps/launcher/assets/icon/`) stays.
- Credit for the original author (kar-mi) and for Buh's Vale Companion stays in the README and release notes.
- Everything else about the look may change; the user asked for a new visual identity across the whole app, overlay and windows alike.

## Evidence on Hand

- Real game assets bundled in the app: class icons (`apps/launcher/assets/class_icons`), status and skill icons (`apps/launcher/assets/status-icons`), and 2,389 item icons (`packages/companion/assets/icons`).
- No testimonials, user counts, or press are on hand; none may be invented.

## Product Principles

1. The game comes first: the overlay informs at a glance and never competes with the fight for attention.
2. Show only what the game reported; when something is unknown, say so instead of guessing.
3. Every tool window is a working instrument for a player between fights: dense, scannable, and fast to read.
4. Players arrange their own overlay, so every element must look right alone, at any size and opacity, in any spot of the screen.
5. Respect the people the app builds on: kar-mi's original work and Buh's Vale Companion are credited, never hidden.

## Accessibility & Inclusion

No specific requirement has been stated. Text over the game must stay legible against unpredictable backgrounds.
