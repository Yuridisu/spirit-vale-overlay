import type { RefObject } from "preact";

export function MarketWorkspace({ frameRef, onLoad }: { frameRef: RefObject<HTMLIFrameElement>; onLoad(): void }) {
  return (
    <iframe
      ref={frameRef}
      class="market-frame"
      title="ValeMarket"
      src="./market.html"
      onLoad={onLoad}
    />
  );
}
