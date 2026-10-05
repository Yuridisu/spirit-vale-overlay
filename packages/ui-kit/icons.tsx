/** The windows' drawn icons, in one 2px square-capped stroke on a 16px grid, as on the overlay.
 * They take the text colour and the text size. */

import type { JSX } from "preact";

function Icon({ children, label }: { children: JSX.Element | JSX.Element[]; label?: string }) {
  return (
    <svg class="icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden={label ? undefined : "true"} role={label ? "img" : undefined} aria-label={label}>
      {children}
    </svg>
  );
}

const stroke = { fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "square", "stroke-linejoin": "miter" } as const;

export function SettingsIcon() {
  return (
    <Icon>
      <path {...stroke} d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4 5 5M11 11l1.6 1.6M3.4 12.6 5 11M11 5l1.6-1.6" />
      <rect {...stroke} x="5" y="5" width="6" height="6" />
    </Icon>
  );
}

export function MinimizeIcon() {
  return <Icon><path {...stroke} d="M3 12h10" /></Icon>;
}

export function MaximizeIcon() {
  return <Icon><rect {...stroke} x="3" y="3" width="10" height="10" /></Icon>;
}

export function RestoreIcon() {
  return <Icon><path {...stroke} d="M3 6h7v7H3zM6 3h7v7" /></Icon>;
}

export function CloseIcon() {
  return <Icon><path {...stroke} d="M4 4 12 12M12 4 4 12" /></Icon>;
}

export function CheckIcon({ label }: { label?: string } = {}) {
  return <Icon label={label}><path {...stroke} d="M3 8.5 6.5 12 13 4.5" /></Icon>;
}

export function ExternalIcon() {
  return <Icon><path {...stroke} d="M9 3h4v4M13 3 7 9M11 10v3H3V5h3" /></Icon>;
}

export function CopyIcon() {
  return <Icon><path {...stroke} d="M5 5h8v8H5zM3 11V3h8" /></Icon>;
}

/** A pin: outlined when the window floats normally, filled when it is pinned on top. */
export function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <Icon>
      <path {...stroke} fill={pinned ? "currentColor" : "none"} d="M5 2.5h6l-1 4 2.5 3h-9L6 6.5z" />
      <path {...stroke} d="M8 9.5v4" />
    </Icon>
  );
}

/** A disclosure chevron: pointing right when closed, down when open. */
export function DisclosureIcon({ open }: { open: boolean }) {
  return <Icon><path {...stroke} d={open ? "M4 6l4 4 4-4" : "M6 4l4 4-4 4"} /></Icon>;
}

export function SearchIcon() {
  return <Icon><path {...stroke} d="M3 3h7v7H3zM10 10l3.5 3.5" /></Icon>;
}

/** Sort direction: one wedge for the active direction, both when unsorted. */
export function SortIcon({ direction }: { direction?: "ascending" | "descending" }) {
  return (
    <Icon>
      {direction !== "descending" ? <path fill="currentColor" d="M8 2.5 12 7H4z" /> : <path fill="none" d="" />}
      {direction !== "ascending" ? <path fill="currentColor" d="M8 13.5 4 9h8z" /> : <path fill="none" d="" />}
    </Icon>
  );
}
