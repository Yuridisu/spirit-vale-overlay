import { signal } from "@preact/signals";

/**
 * The look the backend chose (`<html data-look>`, set by desktop-platform/look.ts). The
 * stylesheets switch on their own; this is for the few components whose markup changed shape
 * in the 0.10.14 redesign and keep their 0.10.13 markup under the classic look.
 */
export const lookState = signal<"broadcast" | "classic">(readLook());

function readLook(): "broadcast" | "classic" {
  return document.documentElement.dataset.look === "classic" ? "classic" : "broadcast";
}

new MutationObserver(() => { lookState.value = readLook(); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ["data-look"] });
