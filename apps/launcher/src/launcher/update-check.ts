/** The release ZIP of the standard Windows build, with what is needed to trust a copy of it. */
export interface ReleaseDownload {
  url: string;
  size: number;
  /** Lowercase hex, as GitHub publishes it for the asset. */
  sha256: string;
}

export interface LatestRelease {
  version: string;
  url: string;
  /** Present only when the release can be installed by the app itself. */
  download?: ReleaseDownload;
}

type FetchRelease = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface GitHubRelease {
  tag_name?: unknown;
  html_url?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
}

/** Downloads are only ever taken from this repository's own releases. */
const RELEASE_DOWNLOAD_PREFIX = "https://github.com/Yuridisu/spirit-vale-overlay/releases/download/";

export const RELEASES_LATEST_URL = "https://api.github.com/repos/Yuridisu/spirit-vale-overlay/releases/latest";

export async function findAvailableUpdate(
  currentVersion: string,
  fetcher: FetchRelease = fetch,
): Promise<LatestRelease | undefined> {
  const response = await fetcher(RELEASES_LATEST_URL, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) return undefined;

  const release = await response.json() as GitHubRelease;
  if (release.draft === true || release.prerelease === true || typeof release.tag_name !== "string" || typeof release.html_url !== "string") {
    return undefined;
  }
  const version = versionFromTag(release.tag_name);
  if (!version || !isNewerVersion(version, currentVersion)) return undefined;
  const download = releaseDownload(release.assets, version);
  return { version, url: release.html_url, ...(download ? { download } : {}) };
}

/**
 * The standard build's ZIP among a release's assets. It is only offered when it comes from this
 * repository's releases and carries a checksum to hold the download to.
 */
export function releaseDownload(assets: unknown, version: string): ReleaseDownload | undefined {
  if (!Array.isArray(assets)) return undefined;
  const name = `spirit-vale-overlay-windows-x64-v${version}.zip`;
  for (const asset of assets as Array<Record<string, unknown>>) {
    if (asset?.name !== name) continue;
    const url = asset.browser_download_url;
    const digest = typeof asset.digest === "string" ? /^sha256:([0-9a-f]{64})$/.exec(asset.digest)?.[1] : undefined;
    if (typeof url !== "string" || !url.startsWith(RELEASE_DOWNLOAD_PREFIX) || !url.endsWith(`/${name}`)) return undefined;
    if (typeof asset.size !== "number" || !Number.isSafeInteger(asset.size) || asset.size <= 0 || !digest) return undefined;
    return { url, size: asset.size, sha256: digest };
  }
  return undefined;
}

export function versionFromTag(tag: string): string | undefined {
  const match = /^app-v(\d+\.\d+\.\d+)$/.exec(tag.trim());
  return match?.[1];
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return false;
  return candidateParts.some((part, index) => part !== currentParts[index]
    && part > (currentParts[index] ?? 0));
}

function parseVersion(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
