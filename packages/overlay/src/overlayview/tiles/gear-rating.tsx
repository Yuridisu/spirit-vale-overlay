import { useTranslator } from "@svoverlay/i18n/browser";
import type { OverlayGearRating } from "../../app-types.ts";
import { gearRatingState } from "../store.ts";
import { StarIcon } from "../icons.tsx";

const MAX_STARS = 6;
const STARS = Array.from({ length: MAX_STARS }, (_, index) => <StarIcon key={index} />);

/**
 * Star ratings for the ten equipped items, in the two columns of the game's equipment screen.
 * Stretched over that screen, each rating sits beside its slot.
 */
export function GearRatingElement() {
  const slots = gearRatingState.value?.slots ?? [];
  return (
    <div class="gear-rating-grid">
      {Array.from({ length: 10 }, (_, index) => (
        <GearRatingCell key={index} rating={slots[index] ?? null} side={index % 2 === 0 ? "left" : "right"} />
      ))}
    </div>
  );
}

function GearRatingCell({ rating, side }: { rating: OverlayGearRating | null; side: "left" | "right" }) {
  const t = useTranslator();
  if (!rating) return <div class={`gear-rating-cell is-${side}`} />;
  return (
    <div
      class={`gear-rating-cell is-${side}`}
      title={t("overlay.gearRating.tooltip", { name: rating.name, stars: rating.stars, lines: rating.lines, maxLines: rating.maxLines })}
    >
      <span class="gear-rating-stars" aria-label={t("overlay.gearRating.aria", { stars: rating.stars })}>
        <span class="gear-rating-stars-empty" aria-hidden="true">{STARS}</span>
        <span class="gear-rating-stars-filled" aria-hidden="true" style={`width:${rating.stars / MAX_STARS * 100}%`}>{STARS}</span>
      </span>
      <span class="gear-rating-detail">{t("overlay.gearRating.detail", { stars: rating.stars, lines: rating.lines, maxLines: rating.maxLines })}</span>
    </div>
  );
}
