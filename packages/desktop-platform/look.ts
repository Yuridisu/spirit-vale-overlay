/**
 * The visual style the windows and the overlay are drawn in. 0.10.14 redrew everything as a
 * broadcast package; "classic" brings back the 0.10.13 look for players who preferred it.
 *
 * Each view ships both stylesheets (`theme.css` / `index.css` and `theme.classic.css` /
 * `index.classic.css`, see `apps/desktop/src/build-shared.ts`); the backend swaps between them
 * on every page load and whenever the setting changes.
 */
export const LOOK_VALUES = ["broadcast", "classic"] as const;
export type Look = typeof LOOK_VALUES[number];

let currentLook: Look = "broadcast";

export function normalizeLook(value: unknown): Look {
  return LOOK_VALUES.includes(value as Look) ? value as Look : "broadcast";
}

export function getLook(): Look { return currentLook; }

export function setLookValue(value: unknown): { next: Look; previous: Look } {
  const next = normalizeLook(value);
  const previous = currentLook;
  currentLook = next;
  return { next, previous };
}

/**
 * The script a view runs to show `look`: it marks `<html data-look>` (components that changed
 * shape in the redesign read it) and points the view's own two stylesheets at that look's files.
 * Only stylesheets served from `/views/` are touched, so pages from elsewhere keep theirs.
 */
export function lookScript(look: Look): string {
  return `(() => {
  const look = ${JSON.stringify(look)};
  document.documentElement.dataset.look = look;
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    let url;
    try { url = new URL(link.href, location.href); } catch { continue; }
    if (!url.pathname.startsWith("/views/")) continue;
    const match = url.pathname.match(/^(.*\\/)(theme|index)(\\.classic)?\\.css$/);
    if (!match) continue;
    const want = match[1] + match[2] + (look === "classic" ? ".classic" : "") + ".css";
    if (url.pathname !== want) link.href = want;
  }
})();`;
}
