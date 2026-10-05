/** How many team colours there are; see `--team-*` in theme.css. */
const TEAM_COLORS = 5;

/** Each player's colour, handed out in the order they first appear and kept while the window is open. */
const teamColors = new Map<string, number>();

/**
 * A player's own colour, the same in every table of the window, so overtaking someone never
 * repaints either of you. Team colours say only who; they never mean threat, loot or value.
 */
export function teamColor(name: string): string {
  let slot = teamColors.get(name);
  if (slot === undefined) {
    slot = teamColors.size % TEAM_COLORS;
    teamColors.set(name, slot);
  }
  return `var(--team-${slot + 1})`;
}
