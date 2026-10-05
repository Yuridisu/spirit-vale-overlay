import { signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { DesktopView, watchBackendReconnecting } from "@svoverlay/desktop-runtime/view";
import { initWindowChrome, type WindowChrome } from "@svoverlay/ui-kit/window-chrome";
import { ensureInitialWindowSize } from "@svoverlay/ui-kit/ensure-window-size";
import { disableWebChrome } from "@svoverlay/ui-kit/disable-web-chrome";
import { repairRendererPayload } from "@svoverlay/ui-kit/renderer-text";
import { formatBytes, formatMeasuredAt } from "@svoverlay/ui-kit/format";
import { useTranslator } from "@svoverlay/i18n/browser";
import type { MessageKey } from "@svoverlay/i18n/messages";
import { TIMER_MODES, formatTimer, timerDisplayMs, timerFinished, type TimerMode } from "@svoverlay/overlay/timer";
import type { LauncherRpc, LauncherState, ToolWindow } from "../../launcher/types.ts";
import { CloseIcon, MinimizeIcon, SettingsIcon } from "@svoverlay/ui-kit/icons";

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 430;
const MINIMUM_WIDTH = 900;
const MINIMUM_HEIGHT = 430;

const TOOLS: Array<{ tool: ToolWindow; titleKey: MessageKey; descriptionKey: MessageKey }> = [
  { tool: "combat", titleKey: "launcher.tool.combat", descriptionKey: "launcher.tool.combat.description" },
  { tool: "rewards", titleKey: "launcher.tool.rewards", descriptionKey: "launcher.tool.rewards.description" },
  { tool: "character", titleKey: "launcher.tool.character", descriptionKey: "launcher.tool.character.description" },
  { tool: "boss-timers", titleKey: "launcher.tool.bossTimers", descriptionKey: "launcher.tool.bossTimers.description" },
  { tool: "build-export", titleKey: "launcher.tool.buildExport", descriptionKey: "launcher.tool.buildExport.description" },
  { tool: "companion", titleKey: "launcher.tool.companion", descriptionKey: "launcher.tool.companion.description" },
];

const state = signal<LauncherState | undefined>(undefined);
const rpc = DesktopView.defineRPC<LauncherRpc>({
  handlers: { requests: {}, messages: { stateChanged: (next) => { state.value = repairRendererPayload(next); } } },
});
const desktopView = new DesktopView({ rpc });

const backendReconnecting = signal(false);
watchBackendReconnecting((reconnecting) => { backendReconnecting.value = reconnecting; });

disableWebChrome();
void ensureInitialWindowSize(desktopView.rpc?.request, { width: MINIMUM_WIDTH, height: MINIMUM_HEIGHT });
void desktopView.rpc?.request.getState({}).then((next) => { state.value = repairRendererPayload(next); });

function App() {
  const chromeRef = useRef<WindowChrome | undefined>(undefined);
  const titlebarRef = (node: HTMLElement | null): void => {
    if (!node || chromeRef.current) return;
    chromeRef.current = initWindowChrome({
      titlebar: node,
      minWidth: MINIMUM_WIDTH,
      minHeight: MINIMUM_HEIGHT,
      getFrame: async () => (await desktopView.rpc?.request.getWindowFrame({})) ?? { x: 0, y: 0, width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT },
      setFrame: (frame) => void desktopView.rpc?.request.setWindowFrame(frame),
    });
  };

  const next = state.value;
  const t = useTranslator();
  const unavailable = next?.captureStatus === "unavailable";
  const warning = next?.captureWarning !== undefined;

  return (
    <main class="app-shell">
      <header ref={titlebarRef} class="titlebar">
        <div class="brand">
          <img class="brand-icon" src="views://assets/app-icon.png" alt="" />
          <span>Spirit Vale Overlay</span>
          <span class="brand-version">{next ? `v${next.appVersion}` : ""}</span>
          <span class="brand-tag">{t("launcher.brandTag")}</span>
        </div>
        <div class="window-controls">
          <button class="icon-button" type="button" aria-label={t("settingsButton.label")} title={t("settingsButton.label")} onClick={() => void desktopView.rpc?.request.openSettings({})}><SettingsIcon /></button>
          <button class="icon-button" type="button" aria-label={t("titleBar.minimize")} title={t("titleBar.minimize")} onClick={() => void desktopView.rpc?.request.windowAction({ action: "minimize" })}><MinimizeIcon /></button>
          <button class="icon-button close-button" type="button" aria-label={t("titleBar.close")} title={t("titleBar.close")} onClick={() => void desktopView.rpc?.request.windowAction({ action: "close" })}><CloseIcon /></button>
        </div>
      </header>

      <section class="launcher-content">
        {backendReconnecting.value && (
          <div class="banner is-warn" aria-live="polite">{t("launcher.backend.reconnecting")}</div>
        )}

        <div class={`capture-status${unavailable ? " is-error" : warning ? " is-warning" : ""}`} aria-live="polite">
          <span class={`status-dot ${unavailable ? "is-err" : warning ? "is-warn" : next?.captureStatus === "capturing" ? "is-ok" : "is-idle"}`} />
          <div><strong>{t("launcher.capture.heading")}</strong><p>{t.text(next?.statusDetail) ?? t("capture.status.starting")}</p></div>
        </div>

        {next?.storageWarning && <div class="banner is-warn" aria-live="polite">{t.text(next.storageWarning)}</div>}

        {next?.update && <UpdateNotification update={next.update} />}

        <div class="tool-grid" aria-label={t("launcher.tools.label")}>
          {TOOLS.map(({ tool, titleKey, descriptionKey }) => (
            <button
              key={tool}
              class="tool-button"
              data-tool={tool}
              type="button"
              onClick={() => void desktopView.rpc?.request.openTool({ tool })}
            >
              <strong>{t(titleKey)}</strong>
              <span>{t(descriptionKey)}</span>
            </button>
          ))}
          <button
            class="tool-button"
            data-tool="settings"
            type="button"
            onClick={() => void desktopView.rpc?.request.openSettings({ section: "manage" })}
          >
            <strong>{t("launcher.manageSettings.title")}</strong>
            <span>{t("launcher.manageSettings.description")}</span>
          </button>
          <TimerPanel timer={next?.timer} shortcuts={next?.overlayShortcuts} />
        </div>
      </section>

      {next?.overlayShortcuts && <OverlayHints shortcuts={next.overlayShortcuts} />}
      {next?.logStorage && <LogStorage usage={next.logStorage} />}
    </main>
  );
}

const applyState = (request: Promise<LauncherState> | undefined): void => {
  void request?.then((result) => { state.value = repairRendererPayload(result); });
};

function clampWhole(value: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.round(value))) : 0;
}

/** Sets up and drives the overlay's timer from a window that, unlike the overlay, takes clicks. */
function TimerPanel({ timer, shortcuts }: { timer: LauncherState["timer"]; shortcuts: LauncherState["overlayShortcuts"] }) {
  const t = useTranslator();
  // The countdown only shows whole seconds elapsed here, so a slow tick is enough to notice it ending.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!timer?.running) return undefined;
    const ticker = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(ticker);
  }, [timer?.running, timer?.startedAtMs]);

  if (!timer) {
    return (
      <div class="timer-panel">
        <div class="timer-panel-heading"><strong>{t("launcher.timer.title")}</strong><span class="timer-panel-status">{t("launcher.timer.unavailable")}</span></div>
      </div>
    );
  }
  const durationSeconds = Math.round(timer.durationMs / 1_000);
  const finished = timerFinished(timer, Math.max(now, Date.now()));
  const status = finished
    ? t("launcher.timer.finished")
    : timer.running
      ? t("launcher.timer.running")
      : timer.elapsedMs > 0 ? t("launcher.timer.paused") : t("launcher.timer.ready");
  const setConfig = (mode: TimerMode, seconds: number): void => {
    applyState(desktopView.rpc?.request.setTimerConfig({ mode, durationSeconds: Math.max(1, seconds) }));
  };

  return (
    <div class="timer-panel">
      <div class="timer-panel-heading">
        <strong>{t("launcher.timer.title")}</strong>
        <span class={`timer-panel-status${finished ? " is-finished" : ""}`} aria-live="polite">
          {status} · {formatTimer(timerDisplayMs(timer, Math.max(now, Date.now())))}
        </span>
        {shortcuts && (
          <span class="timer-panel-hint">
            {t("launcher.timer.hint", { toggle: shortcuts.toggleTimer, reset: shortcuts.resetTimer })}
          </span>
        )}
      </div>
      <div class="timer-panel-config">
        <div class="timer-mode-switch" role="group" aria-label={t("launcher.timer.mode")}>
          {TIMER_MODES.map((mode) => (
            <button key={mode} type="button" aria-pressed={timer.mode === mode} onClick={() => setConfig(mode, durationSeconds)}>
              {t(`overlay.timer.mode.${mode}`)}
            </button>
          ))}
        </div>
        {timer.mode === "countdown" && (
          <>
            <label class="timer-duration">
              <input type="number" min="0" max="1439" value={Math.floor(durationSeconds / 60)}
                onChange={(event) => setConfig(timer.mode, clampWhole(event.currentTarget.valueAsNumber, 1439) * 60 + durationSeconds % 60)} />
              {t("launcher.timer.minutes")}
            </label>
            <label class="timer-duration">
              <input type="number" min="0" max="59" value={durationSeconds % 60}
                onChange={(event) => setConfig(timer.mode, Math.floor(durationSeconds / 60) * 60 + clampWhole(event.currentTarget.valueAsNumber, 59))} />
              {t("launcher.timer.seconds")}
            </label>
          </>
        )}
      </div>
      <div class="timer-panel-actions">
        <button class="is-primary" type="button" onClick={() => applyState(desktopView.rpc?.request.toggleTimer({}))}>
          {timer.running && !finished ? t("launcher.timer.pause") : t("launcher.timer.start")}
        </button>
        <button type="button" onClick={() => applyState(desktopView.rpc?.request.resetTimer({}))}>{t("launcher.timer.reset")}</button>
      </div>
    </div>
  );
}

function OverlayHints({ shortcuts }: { shortcuts: NonNullable<LauncherState["overlayShortcuts"]> }) {
  const t = useTranslator();
  return (
    <footer class="overlay-hints">
      <span><kbd>{shortcuts.toggleLock}</kbd> — {t("launcher.hint.editOverlay")}</span>
      <span><kbd>{shortcuts.toggleOverlayVisible}</kbd> — {t("launcher.hint.toggleOverlay")}</span>
    </footer>
  );
}

function LogStorage({ usage }: { usage: NonNullable<LauncherState["logStorage"]> }) {
  const t = useTranslator();
  return (
    <footer class="log-storage" title={t("launcher.logs.files", { count: usage.files.toLocaleString() })}>
      <span class="log-storage-label">{t("launcher.logs.label")}</span>
      <strong>{formatBytes(usage.bytes)}</strong>
      <span class="log-storage-time">{t("launcher.logs.measured", { when: formatMeasuredAt(usage.measuredAt) })}</span>
    </footer>
  );
}

function UpdateNotification({ update }: { update: NonNullable<LauncherState["update"]> }) {
  const t = useTranslator();
  const install = update.install;
  const busy = install?.phase === "downloading" || install?.phase === "installing";
  const body = install?.phase === "downloading" ? t("launcher.update.downloading", { percent: install.percent })
    : install?.phase === "installing" ? t("launcher.update.installing")
    : install?.phase === "failed" ? t("launcher.update.failed", { detail: install.detail })
    : t("launcher.update.body", { version: update.version });
  return (
    <div class="update-notification" aria-live="polite">
      <div><strong>{t("launcher.update.heading")}</strong><p>{body}</p></div>
      <div class="update-actions">
        {update.canInstall && (
          <button class="update-button update-install-button" type="button" disabled={busy} onClick={() => void desktopView.rpc?.request.installUpdate({})}>
            {install?.phase === "failed" ? t("launcher.update.retry") : t("launcher.update.install")}
          </button>
        )}
        <button class="update-button" type="button" disabled={busy} onClick={() => void desktopView.rpc?.request.openUpdateRelease({})}>{t("launcher.update.view")}</button>
        <button class="update-skip-button" type="button" disabled={busy} onClick={() => void desktopView.rpc?.request.skipUpdateVersion({})}>{t("launcher.update.skip")}</button>
        <button class="update-dismiss-button" type="button" disabled={busy} aria-label={t("launcher.update.dismissAria")} title={t("launcher.update.dismiss")} onClick={() => void desktopView.rpc?.request.dismissUpdateNotification({})}><CloseIcon /></button>
      </div>
    </div>
  );
}

render(<App />, document.getElementById("root")!);
