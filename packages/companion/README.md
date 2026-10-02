# Companion

The bag, loot rules, gold sessions and market of [Vale Companion](https://github.com/bjb2/valecompanion)
by bjb2, brought into this app with the author's agreement so everything lives in one place.

Vale Companion is licensed under the GNU Affero General Public License, version 3 or later, the
same licence as this repository.

## Provenance

Taken from `bjb2/valecompanion` at commit `a6661a6` (release v0.8.0).

| Here | There | Changes |
| --- | --- | --- |
| `src/core/` | `src/core/` | Imports point at this repository's tools packages. The item catalog is bundled instead of read from disk. |
| `src/shared/` | `src/shared/` | `pickup-overlay.ts` is cut down to the one type the loot session uses. |
| `src/market/` | `src/backend/market-*.ts` | Imports only. |
| `src/sounds.ts` | `src/backend/sounds.ts` | Imports only. |
| `src/renderer/` | `src/frontend/` | Settings are cut down to what applies here; alert sounds are no longer played by the page; the waiting hints say what makes the game send the bag. |
| `src/bun/service.ts` | `src/backend/index.ts` | Rewritten around this app's capture. See below. |
| `assets/` | `assets/`, `docs/starter-ruleset.txt` | The starter ruleset is `src/starter-ruleset.ts`. |
| `test/` | `test/` | The tests of the code above. |

Not taken: Vale Companion's own packet capture, its Electron shell, updater and Linux support, and
its on-screen overlays, which this app already has in its own form.

## How it fits in

- `src/bun/service.ts` is fed every decoded packet by the capture coordinator. It keeps the loot and
  gold sessions and serves Vale Companion's pages and their `/v1` API on `127.0.0.1`, on a port the
  system picks. Requests from any origin that is not local are refused.
- `src/bun/index.ts` is the window: this app's title bar around a frame showing those pages.
- `src/bun/sound-player.ts` plays alert sounds through Windows directly, so they are heard whether
  or not the window is open.

## What leaves the machine

- **Reading the market** fetches the public listings and price history from
  `market-api.spiritvalers.com`. It starts the first time the Companion window is opened.
- **Market contribution** uploads the listings seen while browsing the market in game to the same
  service. It is off until the player turns it on in the Companion's settings, which say what is
  sent. Vale Companion ships with it on; here it is opt-in.

Nothing else here makes a network request.

## Item icons

`assets/icons` holds the item icons Vale Companion ships. They are Spirit Vale artwork, published
by the game's wiki at spiritvalers.com, and remain the property of their rights holders; the
licence of this repository does not cover them. An icon for an item newer than this set can be
dropped into `data/companion/icons`; an item with no icon shows its initials.

## Working on the pages

```bash
bun run packages/companion/scripts/dev.ts
```

builds the pages and serves them without the game or the desktop shell.
