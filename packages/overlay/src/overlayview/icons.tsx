/** The overlay's few drawn icons, in one 2px stroke on a 16px grid; they take the text colour. */

export function CheckIcon() {
  return (
    <svg class="icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg class="icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <path d="M4 4 12 12M12 4 4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" />
    </svg>
  );
}

/** A five-point star, filled, for ratings. */
export function StarIcon() {
  return (
    <svg class="icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">
      <path d="M8 1.2 10 6l5.2.4-4 3.4 1.3 5.1L8 12.1 3.5 14.9l1.3-5.1-4-3.4L6 6z" fill="currentColor" />
    </svg>
  );
}
