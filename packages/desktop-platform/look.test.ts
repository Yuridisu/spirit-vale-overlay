import { describe, expect, test } from "bun:test";

import { lookScript, normalizeLook } from "./look.ts";

interface FakeLink { rel: string; href: string }

/** Runs a look script against a page with the given stylesheet links. */
function run(look: "broadcast" | "classic", hrefs: string[], origin = "http://127.0.0.1:5000") {
  const links: FakeLink[] = hrefs.map((href) => ({ rel: "stylesheet", href: new URL(href, `${origin}/views/x/index.html`).href }));
  const html = { dataset: {} as Record<string, string> };
  const document = { documentElement: html, querySelectorAll: () => links };
  const location = { href: `${origin}/views/x/index.html` };
  new Function("document", "location", lookScript(look))(document, location);
  return { look: html.dataset.look, hrefs: links.map((link) => new URL(link.href, origin).pathname) };
}

describe("look", () => {
  test("anything unknown is the new look", () => {
    expect(normalizeLook("classic")).toBe("classic");
    expect(normalizeLook("legacy")).toBe("broadcast");
    expect(normalizeLook(undefined)).toBe("broadcast");
  });

  test("classic points the view's two stylesheets at their classic files, and back", () => {
    const classic = run("classic", ["/views/mainview/theme.css", "/views/mainview/index.css"]);
    expect(classic.look).toBe("classic");
    expect(classic.hrefs).toEqual(["/views/mainview/theme.classic.css", "/views/mainview/index.classic.css"]);
    const back = run("broadcast", ["/views/mainview/theme.classic.css", "/views/mainview/index.classic.css"]);
    expect(back.hrefs).toEqual(["/views/mainview/theme.css", "/views/mainview/index.css"]);
  });

  test("relative links resolve; pages served from elsewhere are left alone", () => {
    expect(run("classic", ["theme.css", "index.css"]).hrefs).toEqual(["/views/x/theme.classic.css", "/views/x/index.classic.css"]);
    expect(run("classic", ["/companion/index.css", "/views/x/fonts.css"]).hrefs).toEqual(["/companion/index.css", "/views/x/fonts.css"]);
  });
});
