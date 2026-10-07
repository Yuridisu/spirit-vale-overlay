import type { BrowserWindow } from "@svoverlay/desktop-runtime";

import { getLook, lookScript, setLookValue, type Look } from "./look.ts";
import { DisposableStore, onWebviewEvent, onceWindowEvent, type Dispose } from "./window-lifecycle.ts";

export { getLook, normalizeLook, LOOK_VALUES } from "./look.ts";
export type { Look } from "./look.ts";

const windows = new Set<BrowserWindow>();

/** Keeps a window in the chosen look: on every page load, and when the look changes. */
export function registerLookWindow(window: BrowserWindow): Dispose {
  const lifecycle = new DisposableStore();
  windows.add(window);
  lifecycle.add(onWebviewEvent(window.webview, "dom-ready", () => applyLook(window)));
  lifecycle.add(() => { windows.delete(window); });
  lifecycle.add(onceWindowEvent(window, "close", () => lifecycle.dispose()));
  return () => lifecycle.dispose();
}

export function setLook(value: unknown): Look {
  const { next, previous } = setLookValue(value);
  if (next !== previous) for (const window of windows) applyLook(window);
  return next;
}

function applyLook(window: BrowserWindow): void {
  window.webview.executeJavascript(lookScript(getLook()));
}
