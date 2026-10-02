const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const shortFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const exactFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Exact below a million, compact above: the Gold tab's house style.
export function compactMoney(value: number): string {
  const rounded = Math.round(Math.abs(value));
  return rounded < 1_000_000 ? exactFormatter.format(rounded) : compactFormatter.format(rounded);
}

// Always compact, one decimal: for spots with room for a handful of characters.
export function shortMoney(value: number): string {
  return shortFormatter.format(Math.round(value));
}

export function exactMoney(value: number): string {
  return exactFormatter.format(Math.round(value));
}
