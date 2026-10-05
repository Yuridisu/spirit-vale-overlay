import { useTranslator } from "@svoverlay/i18n/browser";
import { classIconUrlForArchetype, classIconUrlForName } from "@svoverlay/ui-kit/class-display";

import { chromeState } from "../store.ts";

export function WaitingForDps({ label }: { label?: string } = {}) {
  const t = useTranslator();
  const toggleLockShortcut = chromeState.value?.shortcuts.toggleLock;
  return (
    <div class="empty">
      <span>{label ?? t("overlay.waitingForDps")}</span>
      <span class="empty-help">{toggleLockShortcut
        ? t("overlay.waitingHelp.shortcut", { shortcut: toggleLockShortcut })
        : t("overlay.waitingHelp")}</span>
    </div>
  );
}

/** How many team colours there are; see `--team-*` in the stylesheet. */
const TEAM_COLORS = 5;

/** Each player's colour, handed out in the order they first appear and kept for the session. */
const teamColors = new Map<string, number>();

/**
 * A player's own colour, the same in every table and every boss block, so overtaking someone never
 * repaints either of you. The first eight players met each get a colour of their own.
 */
export function teamColor(name: string): string {
  let slot = teamColors.get(name);
  if (slot === undefined) {
    slot = teamColors.size % TEAM_COLORS;
    teamColors.set(name, slot);
  }
  return `var(--team-${slot + 1})`;
}

export function overlayClassIcon(archetype: number | undefined): string {
  return classIconUrlForArchetype(archetype) ?? classIconUrlForName("Weaver")!;
}
