import { BrowserView } from "@svoverlay/desktop-runtime";
import type { WindowPlacementStore } from "@svoverlay/desktop-platform/window-placement";
import { createManagedWindow } from "@svoverlay/desktop-platform/managed-window";

import type { CompanionRpc } from "../app-types.ts";
import type { CompanionService } from "./service.ts";

const MINIMUM_WIDTH = 980;
const MINIMUM_HEIGHT = 620;

export interface CompanionWindowOptions {
  service: CompanionService;
  placements?: WindowPlacementStore;
  onClosed?: () => void;
  onOpenSettings?: () => void;
}

/** A frame around the companion's own pages, which the service serves on this machine. */
export function createCompanionWindow(options: CompanionWindowOptions) {
  options.service.activate();

  const rpc = BrowserView.defineRPC<CompanionRpc>({
    maxRequestTime: 30_000,
    handlers: {
      requests: {
        getState: () => ({ origin: options.service.origin }),
        openSettings: () => { options.onOpenSettings?.(); },
        windowAction: ({ action }) => {
          if (action === "minimize") window.minimize();
          else window.close();
        },
        getWindowFrame: () => window.getFrame(),
        setWindowFrame: ({ x, y, width, height }) => { window.setFrame(x, y, width, height); },
        toggleMaximize: () => {
          if (window.isMaximized()) window.unmaximize();
          else window.maximize();
          return { maximized: window.isMaximized() };
        },
      },
      messages: {},
    },
  });

  const { window } = createManagedWindow({
    title: "Spirit Vale Companion",
    url: "views://companionview/index.html",
    rpc,
    minimum: { width: MINIMUM_WIDTH, height: MINIMUM_HEIGHT },
    placements: options.placements,
    placementKey: "companion",
    defaultFrame: { x: 140, y: 100, width: 1320, height: 820 },
    onClose: () => { options.onClosed?.(); },
  });

  return {
    show: () => window.show(),
    activate: () => window.activate(),
    close: async () => { window.close(); },
  };
}
