import type { RPCSchema } from "@svoverlay/contracts/rpc";
import type { MaximizableWindowChromeRequests } from "@svoverlay/contracts/window-rpc";

export interface CompanionWindowState {
  /** Where the companion's own pages and data are served, on this machine only. */
  origin: string;
}

export type CompanionRpc = {
  bun: RPCSchema<{
    requests: MaximizableWindowChromeRequests & {
      getState: { params: Record<string, never>; response: CompanionWindowState };
    };
  }>;
  webview: RPCSchema<{ messages: Record<string, never> }>;
};
