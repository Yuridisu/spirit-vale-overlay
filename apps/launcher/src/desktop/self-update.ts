import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { bundleLayout } from "@svoverlay/desktop-platform/bundle-layout";

import type { ReleaseDownload } from "../launcher/update-check.ts";

/** A release ZIP is some tens of megabytes; anything far beyond that is not one. */
const MAX_DOWNLOAD_BYTES = 400 * 1024 * 1024;
const EXECUTABLE = "spirit-vale-overlay-win_x64.exe";
/** What a staged release must contain before anything of the running app is replaced by it. */
const REQUIRED_FILES = [EXECUTABLE, bundleLayout.resourceBundle, bundleLayout.backendEntrypoint, `${bundleLayout.binaryDirectory}/bun.exe`];

export interface StagedUpdate {
  /** The extracted release folder, ready to be copied over the application folder. */
  stagedRoot: string;
  /** Where the update keeps its download, its staging folder, its backup and its log. */
  workDirectory: string;
}

export type UpdateProgress = (receivedBytes: number, totalBytes: number) => void;

/** Where an update is staged: inside the app's own data folder, so nothing is written elsewhere. */
export function updateWorkDirectory(root: string): string {
  return path.join(root, "data", "runtime", "update");
}

/**
 * Whether this installation can replace itself: the portable Neutralino bundle on Windows, with
 * its files where the release ZIP puts them. Anything else is sent to the download page instead.
 */
export function canSelfUpdate(root: string | undefined, platform: NodeJS.Platform = process.platform): root is string {
  return platform === "win32" && root !== undefined && REQUIRED_FILES.every((file) => existsSync(path.join(root, file)));
}

/**
 * Downloads a release and unpacks it beside the running app, without touching the app itself.
 *
 * The download is only accepted when its size and SHA-256 are the ones GitHub publishes for the
 * asset, and the unpacked folder only when it holds a complete bundle. Any failure throws and
 * leaves the installation exactly as it was.
 */
export async function stageUpdate(options: {
  root: string;
  download: ReleaseDownload;
  onProgress?: UpdateProgress;
  fetcher?: typeof fetch;
  extract?: (zipPath: string, destination: string) => Promise<void>;
}): Promise<StagedUpdate> {
  const { root, download } = options;
  if (download.size <= 0 || download.size > MAX_DOWNLOAD_BYTES) throw new Error("The update has an unexpected size.");
  const workDirectory = updateWorkDirectory(root);
  const stagingDirectory = path.join(workDirectory, "staged");
  const zipPath = path.join(workDirectory, "update.zip");
  await rm(stagingDirectory, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await mkdir(stagingDirectory, { recursive: true });

  const response = await (options.fetcher ?? fetch)(download.url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`The update could not be downloaded (HTTP ${response.status}).`);
  const hash = createHash("sha256");
  const chunks: Uint8Array[] = [];
  let received = 0;
  for await (const chunk of response.body) {
    received += chunk.length;
    if (received > download.size) throw new Error("The update is larger than the release says it is.");
    hash.update(chunk);
    chunks.push(chunk);
    options.onProgress?.(received, download.size);
  }
  if (received !== download.size) throw new Error("The update download was cut short.");
  if (hash.digest("hex") !== download.sha256) throw new Error("The update does not match the checksum of the release.");
  await writeFile(zipPath, Buffer.concat(chunks, received));

  await (options.extract ?? extractZip)(zipPath, stagingDirectory);
  const stagedRoot = findStagedRoot(stagingDirectory);
  if (!stagedRoot) throw new Error("The update is not a complete Spirit Vale Overlay release.");
  return { stagedRoot, workDirectory };
}

/** The release ZIP holds one folder; that folder is the bundle. */
export function findStagedRoot(stagingDirectory: string): string | undefined {
  const candidates = [stagingDirectory];
  try {
    for (const entry of readdirSync(stagingDirectory, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(path.join(stagingDirectory, entry.name));
    }
  } catch {
    return undefined;
  }
  return candidates.find((candidate) => REQUIRED_FILES.every((file) => existsSync(path.join(candidate, file))));
}

/**
 * Starts the script that swaps the files once the app has exited, then starts the app again.
 * The caller shuts the app down straight after.
 *
 * The script has to outlive this process, and a child started the ordinary way does not: it is
 * taken down with the app. Windows' management service is asked to start it instead, which makes
 * it nobody's child, in the player's own session and with their own environment rather than the
 * portable one this process runs under.
 */
export async function launchUpdater(root: string, staged: StagedUpdate): Promise<void> {
  const scriptPath = path.join(staged.workDirectory, "apply-update.ps1");
  await writeFile(scriptPath, UPDATE_SCRIPT, "utf8");
  const powershell = systemPowerShell();
  const commandLine = [
    powershell, "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", scriptPath,
    "-Root", root, "-Staged", staged.stagedRoot, "-Exe", EXECUTABLE,
  ].map((part) => `"${part}"`).join(" ");
  const launcher = Bun.spawn([
    powershell, "-NoProfile", "-Command",
    `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${singleQuoted(commandLine)} }; if ($r.ReturnValue -ne 0) { exit 1 }`,
  ], { stdio: ["ignore", "ignore", "ignore"], windowsHide: true });
  if (await launcher.exited !== 0) throw new Error("The updater could not be started.");
}

function systemPowerShell(): string {
  return path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function singleQuoted(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/** Removes what a finished update left behind. Its log is kept, for a failure to be read from. */
export async function cleanUpAfterUpdate(root: string): Promise<void> {
  const workDirectory = updateWorkDirectory(root);
  await Promise.all([
    rm(path.join(workDirectory, "staged"), { recursive: true, force: true }),
    rm(path.join(workDirectory, "backup"), { recursive: true, force: true }),
    rm(path.join(workDirectory, "update.zip"), { force: true }),
    rm(path.join(workDirectory, "apply-update.ps1"), { force: true }),
  ]).catch(() => {});
}

async function extractZip(zipPath: string, destination: string): Promise<void> {
  const extraction = Bun.spawn([
    systemPowerShell(), "-NoProfile", "-Command",
    `Expand-Archive -LiteralPath ${singleQuoted(zipPath)} -DestinationPath ${singleQuoted(destination)} -Force`,
  ], { stdio: ["ignore", "ignore", "ignore"], windowsHide: true });
  if (await extraction.exited !== 0) throw new Error("The update could not be unpacked.");
}

/**
 * Waits for every process of the app to exit, swaps in the staged files and starts the app again.
 * The data folder is never touched. The files being replaced are moved aside first, so a copy
 * that fails half way is undone and the app that restarts is the one that was there before.
 */
export const UPDATE_SCRIPT = String.raw`param(
  [Parameter(Mandatory = $true)][string]$Root,
  [Parameter(Mandatory = $true)][string]$Staged,
  [Parameter(Mandatory = $true)][string]$Exe,
  [switch]$NoRestart
)
$ErrorActionPreference = 'Stop'
$work = Join-Path $Root 'data\runtime\update'
$log = Join-Path $work 'update.log'
function Write-UpdateLog([string]$message) {
  Add-Content -LiteralPath $log -Value ('{0} {1}' -f (Get-Date -Format o), $message)
}
function Get-AppProcess {
  $prefix = $Root.TrimEnd('\') + '\'
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase) }
}
$replaced = @('extensions', 'resources.neu', $Exe)
$backup = Join-Path $work 'backup'
try {
  Write-UpdateLog "updating from $Staged"
  $deadline = (Get-Date).AddSeconds(45)
  while ((Get-AppProcess) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 300 }
  Get-AppProcess | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 700

  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
  New-Item -ItemType Directory -Path $backup | Out-Null
  $moved = @()
  try {
    foreach ($name in $replaced) {
      Move-Item -LiteralPath (Join-Path $Root $name) -Destination (Join-Path $backup $name)
      $moved += $name
    }
    foreach ($name in $replaced) {
      Copy-Item -LiteralPath (Join-Path $Staged $name) -Destination (Join-Path $Root $name) -Recurse -Force
    }
    $readme = Join-Path $Staged 'README.txt'
    if (Test-Path -LiteralPath $readme) { Copy-Item -LiteralPath $readme -Destination (Join-Path $Root 'README.txt') -Force }
    Write-UpdateLog 'updated'
  } catch {
    Write-UpdateLog "failed, restoring the previous version: $_"
    foreach ($name in $moved) {
      $target = Join-Path $Root $name
      if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
      Move-Item -LiteralPath (Join-Path $backup $name) -Destination $target
    }
  }
} catch {
  Write-UpdateLog "failed: $_"
} finally {
  if (-not $NoRestart) { Start-Process -FilePath (Join-Path $Root $Exe) -WorkingDirectory $Root }
}
`;
