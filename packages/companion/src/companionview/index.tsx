import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DesktopView } from "@svoverlay/desktop-runtime/view";
import { TitleBar } from "@svoverlay/ui-kit/title-bar";
import { ensureInitialWindowSize } from "@svoverlay/ui-kit/ensure-window-size";
import { useTranslator } from "@svoverlay/i18n/browser";

import type { CompanionRpc } from "../app-types.ts";

const MINIMUM_WIDTH = 980;
const MINIMUM_HEIGHT = 620;

const rpc = DesktopView.defineRPC<CompanionRpc>({ handlers: { requests: {}, messages: {} } });
const desktopView = new DesktopView({ rpc });
void ensureInitialWindowSize(desktopView.rpc?.request, { width: MINIMUM_WIDTH, height: MINIMUM_HEIGHT });

function App() {
  const t = useTranslator();
  const [origin, setOrigin] = useState<string>();
  useEffect(() => {
    void desktopView.rpc?.request.getState({}).then((state) => setOrigin(state.origin));
  }, []);

  return <div class="app-shell">
    <TitleBar appTag={t("companion.window.tag")} minWidth={MINIMUM_WIDTH} minHeight={MINIMUM_HEIGHT}
      getFrame={() => desktopView.rpc!.request.getWindowFrame({})}
      setFrame={(frame) => desktopView.rpc?.request.setWindowFrame(frame)}
      toggleMaximize={async () => (await desktopView.rpc!.request.toggleMaximize({})).maximized}
      onMinimize={() => void desktopView.rpc?.request.windowAction({ action: "minimize" })}
      onClose={() => void desktopView.rpc?.request.windowAction({ action: "close" })}
    />
    {origin
      ? <iframe class="companion-frame" title={t("companion.window.tag")} src={`${origin}/`} />
      : <div class="companion-loading">{t("companion.loading")}</div>}
  </div>;
}

render(<App />, document.getElementById("root")!);
