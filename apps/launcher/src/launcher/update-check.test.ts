import { describe, expect, test } from "bun:test";

import { findAvailableUpdate, isNewerVersion, releaseDownload, versionFromTag } from "./update-check.ts";

describe("release update checks", () => {
  test("recognizes the app release tag format", () => {
    expect(versionFromTag("app-v0.6.5")).toBe("0.6.5");
    expect(versionFromTag("v0.6.5")).toBeUndefined();
  });

  test("compares semantic release versions", () => {
    expect(isNewerVersion("0.7.0", "0.6.4")).toBe(true);
    expect(isNewerVersion("0.6.5", "0.6.4")).toBe(true);
    expect(isNewerVersion("0.6.4", "0.6.4")).toBe(false);
    expect(isNewerVersion("0.6.3", "0.6.4")).toBe(false);
  });

  test("returns a newer published GitHub release", async () => {
    const update = await findAvailableUpdate("0.6.4", async () => new Response(JSON.stringify({
      tag_name: "app-v0.6.5",
      html_url: "https://github.com/kar-mi/spirit-vale-overlay/releases/tag/app-v0.6.5",
    }), { status: 200 }));
    expect(update).toEqual({
      version: "0.6.5",
      url: "https://github.com/kar-mi/spirit-vale-overlay/releases/tag/app-v0.6.5",
    });
  });

  test("does not notify for failed, draft, or older releases", async () => {
    const unavailable = await findAvailableUpdate("0.6.4", async () => new Response("", { status: 503 }));
    const draft = await findAvailableUpdate("0.6.4", async () => new Response(JSON.stringify({
      tag_name: "app-v0.6.5", html_url: "https://example.test", draft: true,
    })));
    const older = await findAvailableUpdate("0.6.4", async () => new Response(JSON.stringify({
      tag_name: "app-v0.6.3", html_url: "https://example.test",
    })));
    expect(unavailable).toBeUndefined();
    expect(draft).toBeUndefined();
    expect(older).toBeUndefined();
  });
});

describe("release downloads", () => {
  const name = "spirit-vale-overlay-windows-x64-v0.6.5.zip";
  const url = `https://github.com/Yuridisu/spirit-vale-overlay/releases/download/app-v0.6.5/${name}`;
  const sha256 = "a".repeat(64);
  const asset = { name, browser_download_url: url, size: 1_000, digest: `sha256:${sha256}` };

  test("offers the standard build's ZIP with its size and checksum", async () => {
    const update = await findAvailableUpdate("0.6.4", async () => new Response(JSON.stringify({
      tag_name: "app-v0.6.5",
      html_url: "https://example.test/release",
      assets: [{ ...asset, name: "spirit-vale-overlay-electron-windows-x64-v0.6.5.zip" }, asset],
    })));
    expect(update?.download).toEqual({ url, size: 1_000, sha256 });
  });

  test("offers nothing without a checksum, or from anywhere but this repository's releases", () => {
    expect(releaseDownload([{ ...asset, digest: undefined }], "0.6.5")).toBeUndefined();
    expect(releaseDownload([{ ...asset, browser_download_url: `https://example.test/${name}` }], "0.6.5")).toBeUndefined();
    expect(releaseDownload([asset], "0.6.6")).toBeUndefined();
    expect(releaseDownload(undefined, "0.6.5")).toBeUndefined();
  });
});
