import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../src/renderer/market.html", import.meta.url), "utf8");
const source = html.slice(html.indexOf("function parseStatFilter("), html.indexOf("function percentileDisc("));
const { variantHasFilter, parseStatFilter, encodeStatFilter } = runInNewContext(`${source}; ({ variantHasFilter, parseStatFilter, encodeStatFilter })`);

test("market counts distinct qualifying lines instead of summing or reusing one roll", () => {
  const variant = { stats: [{ name: "Str", displayValue: 12 }, { name: "Str", displayValue: 8 }] };
  expect(variantHasFilter(variant, { name: "Str", min: 8, count: 2 })).toBe(true);
  expect(variantHasFilter(variant, { name: "Str", min: 10, count: 2 })).toBe(false);
  expect(variantHasFilter(variant, { name: "Str", min: 20 })).toBe(false);
  expect(variantHasFilter(variant, { name: "Str", min: 10 })).toBe(true);
  expect(variantHasFilter({ stats: [variant.stats[0]] }, { name: "Str", count: 2 })).toBe(false);
  expect(variantHasFilter(variant, { name: "Agi", count: 2 })).toBe(false);
});

test("market URLs preserve line counts and accept existing filters", () => {
  expect(parseStatFilter("Str:8~2")).toEqual({ name: "Str", min: 8, count: 2 });
  expect(encodeStatFilter(parseStatFilter("Str:8~2"))).toBe("Str:8~2");
  expect(encodeStatFilter(parseStatFilter("Str~2"))).toBe("Str~2");
  expect(encodeStatFilter(parseStatFilter("Str:8"))).toBe("Str:8");
  expect(parseStatFilter("Str~0")).toBeNull();
});
