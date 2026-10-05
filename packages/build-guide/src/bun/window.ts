import { BrowserView, Utils } from "@svoverlay/desktop-runtime";
import type { WindowPlacementStore } from "@svoverlay/desktop-platform/window-placement";
import { createManagedWindow } from "@svoverlay/desktop-platform/managed-window";

import type { BuildGuideRpc } from "../app-types.ts";
import type { BuildGuideService } from "../service.ts";

const MINIMUM_WIDTH = 860;
const MINIMUM_HEIGHT = 560;

export interface BuildGuideWindowOptions {
  service: BuildGuideService;
  placements?: WindowPlacementStore;
  onClosed?: () => void;
  onOpenSettings?: () => void;
}

/** The Build Guide window: pick a community build for your class, then see what to level and farm. */
export function createBuildGuideWindow(options: BuildGuideWindowOptions) {
  const { service } = options;
  const state = () => service.state();
  const publish = () => {
    try {
      rpc.send.stateChanged(state());
    } catch {
      /* The view may still be connecting. */
    }
  };

  const rpc = BrowserView.defineRPC<BuildGuideRpc>({
    maxRequestTime: 30_000,
    handlers: {
      requests: {
        getState: () => state(),
        setClass: async ({ className }) => { await service.setClass(className); return state(); },
        setSort: async ({ sort }) => { await service.setSort(sort); return state(); },
        selectBuild: async ({ id }) => { await service.selectBuild(id); return state(); },
        setStage: ({ stage }) => { service.setStage(stage); return state(); },
        setGuiding: ({ guiding }) => { service.setGuiding(guiding); return state(); },
        refresh: async () => { await service.refresh(); return state(); },
        openOnSite: () => {
          const url = service.siteUrl();
          if (url) Utils.openExternal(url);
        },
        openSettings: () => { options.onOpenSettings?.(); },
        windowAction: ({ action }) => {
          if (action === "minimize") window.minimize();
          else window.close();
        },
        getWindowFrame: () => window.getFrame(),
        setWindowFrame: ({ x, y, width, height }) => { window.setFrame(x, y, width, height); },
      },
      messages: {},
    },
  });

  const { window, lifecycle } = createManagedWindow({
    title: "Spirit Vale Build Guide",
    url: "views://buildguideview/index.html",
    rpc,
    minimum: { width: MINIMUM_WIDTH, height: MINIMUM_HEIGHT },
    placements: options.placements,
    placementKey: "build-guide",
    defaultFrame: { x: 180, y: 110, width: 1180, height: 780 },
    onClose: () => { options.onClosed?.(); },
  });
  lifecycle.add(service.subscribe(publish));

  return {
    show: () => window.show(),
    activate: () => window.activate(),
    close: async () => { window.close(); },
  };
}
