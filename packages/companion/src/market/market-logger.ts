import { copyFile, mkdir, open, readdir, rm, stat, writeFile, type FileHandle } from "node:fs/promises";
import path from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface AppLogger {
  readonly sessionId: string;
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

export interface LocalLoggerOptions {
  now?: () => Date;
  sessionId?: string;
  component?: "application" | "backend" | "shell";
  maxFileBytes?: number;
  maxFiles?: number;
  maxTotalBytes?: number;
  maxAgeMs?: number;
  maxBufferedBytes?: number;
  maxExports?: number;
}

export interface LoggerStats {
  bufferedBytes: number;
  droppedRecords: number;
  failed: boolean;
  files: number;
}

export interface DiagnosticsExport {
  path: string;
  createdAt: string;
  logFiles: number;
}

const DEFAULT_MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_FILES = 20;
const DEFAULT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1_000;
const DEFAULT_MAX_BUFFERED_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_EXPORTS = 5;
const LOG_SCHEMA_VERSION = 1;
const SENSITIVE_KEYS: Record<string, true> = {
  authorization: true,
  batch: true,
  body: true,
  buyer: true,
  cookie: true,
  installationtoken: true,
  listing: true,
  listings: true,
  observation: true,
  observations: true,
  packet: true,
  packetdata: true,
  packetpayload: true,
  password: true,
  payload: true,
  rawpacket: true,
  secret: true,
  seller: true,
  token: true,
};

export class LocalLogger implements AppLogger {
  readonly sessionId: string;
  readonly directory: string;

  private readonly now: () => Date;
  private readonly startedAt: Date;
  private readonly component: "application" | "backend" | "shell";
  private readonly maxFileBytes: number;
  private readonly maxFiles: number;
  private readonly maxTotalBytes: number;
  private readonly maxAgeMs: number;
  private readonly maxBufferedBytes: number;
  private readonly maxExports: number;
  private readonly sessionFiles: string[] = [];
  private sequence = 0;
  private segment = 0;
  private fileBytes = 0;
  private queuedBytes = 0;
  private droppedRecords = 0;
  private handle: FileHandle | undefined;
  private tail: Promise<void> = Promise.resolve();
  private firstFailure?: Error;
  private writeFailureReported = false;
  private overflowReported = false;
  private closed = false;

  private constructor(
    private readonly dataDirectory: string,
    private readonly version: string,
    options: LocalLoggerOptions,
  ) {
    this.directory = path.join(dataDirectory, "logs");
    this.now = options.now ?? (() => new Date());
    this.startedAt = this.now();
    this.sessionId = options.sessionId ?? crypto.randomUUID();
    this.component = options.component ?? "application";
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    this.maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    this.maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
    this.maxExports = options.maxExports ?? DEFAULT_MAX_EXPORTS;
  }

  static async create(dataDirectory: string, version: string, options: LocalLoggerOptions = {}): Promise<LocalLogger> {
    const logger = new LocalLogger(dataDirectory, version, options);
    await mkdir(logger.directory, { recursive: true });
    await pruneLogFiles(logger.directory, {
      maxFiles: logger.maxFiles,
      maxTotalBytes: logger.maxTotalBytes,
      maxAgeMs: logger.maxAgeMs,
      nowMs: logger.now().getTime(),
    });
    return logger;
  }

  debug(event: string, fields?: LogFields): void {
    this.log("debug", event, fields);
  }

  info(event: string, fields?: LogFields): void {
    this.log("info", event, fields);
  }

  warn(event: string, fields?: LogFields): void {
    this.log("warn", event, fields);
  }

  error(event: string, fields?: LogFields): void {
    this.log("error", event, fields);
  }

  log(level: LogLevel, event: string, fields: LogFields = {}): void {
    if (this.closed) {
      this.droppedRecords += 1;
      return;
    }
    const record = {
      schemaVersion: LOG_SCHEMA_VERSION,
      at: this.now().toISOString(),
      sequence: ++this.sequence,
      sessionId: this.sessionId,
      version: this.version,
      level,
      event,
      data: sanitizeValue(fields) as Record<string, unknown>,
    };
    const line = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.byteLength(line);
    if (this.queuedBytes + bytes > this.maxBufferedBytes) {
      this.droppedRecords += 1;
      if (!this.overflowReported) {
        this.overflowReported = true;
        console.error(`[valemarket] log buffer exceeded ${this.maxBufferedBytes} bytes; records are being dropped`);
      }
      return;
    }
    this.overflowReported = false;
    this.queuedBytes += bytes;
    this.tail = this.tail
      .catch(() => {})
      .then(() => this.append(line, bytes))
      .catch((error) => this.reportWriteFailure(error))
      .finally(() => { this.queuedBytes -= bytes; });
  }

  async flush(): Promise<void> {
    await this.tail;
    if (this.firstFailure !== undefined) throw this.firstFailure;
  }

  async close(): Promise<void> {
    if (this.closed) {
      await this.flush();
      return;
    }
    this.closed = true;
    await this.tail;
    const handle = this.handle;
    this.handle = undefined;
    if (handle !== undefined) await handle.close().catch((error) => this.reportWriteFailure(error));
    if (this.firstFailure !== undefined) throw this.firstFailure;
  }

  stats(): LoggerStats {
    return {
      bufferedBytes: this.queuedBytes,
      droppedRecords: this.droppedRecords,
      failed: this.firstFailure !== undefined,
      files: this.sessionFiles.length,
    };
  }

  async exportDiagnostics(state: unknown): Promise<DiagnosticsExport> {
    const createdAt = this.now().toISOString();
    this.info("diagnostics.export.started");
    await this.flush();

    const exportsDirectory = path.join(this.dataDirectory, "diagnostics");
    await mkdir(exportsDirectory, { recursive: true });
    await pruneExportDirectories(exportsDirectory, this.maxExports - 1);
    const exportName = `valemarket-diagnostics-${filenameTimestamp(new Date(createdAt))}-${this.sessionId.slice(0, 8)}`;
    const exportPath = path.join(exportsDirectory, exportName);
    await mkdir(exportPath);

    const logPaths = await this.existingSessionFiles();
    const copiedLogs: string[] = [];
    for (const source of logPaths) {
      const filename = path.basename(source);
      await copyFile(source, path.join(exportPath, filename));
      copiedLogs.push(filename);
    }
    await writeFile(path.join(exportPath, "desktop-state.json"), `${JSON.stringify(sanitizeValue(state), null, 2)}\n`, "utf8");
    await writeFile(path.join(exportPath, "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      appVersion: this.version,
      createdAt,
      sessionId: this.sessionId,
      logFiles: copiedLogs,
      logger: this.stats(),
    }, null, 2)}\n`, "utf8");
    this.info("diagnostics.export.completed", { logFiles: copiedLogs.length });
    return { path: exportPath, createdAt, logFiles: copiedLogs.length };
  }

  private async append(line: string, bytes: number): Promise<void> {
    if (this.fileBytes > 0 && this.fileBytes + bytes > this.maxFileBytes) await this.rotate();
    const handle = await this.ensureHandle();
    await handle.writeFile(line, "utf8");
    this.fileBytes += bytes;
  }

  private async ensureHandle(): Promise<FileHandle> {
    if (this.handle !== undefined) return this.handle;
    const filePath = path.join(this.directory, `${filenameTimestamp(this.startedAt)}-${this.sessionId}-${this.component}-${String(this.segment).padStart(3, "0")}.jsonl`);
    this.handle = await open(filePath, "a");
    this.fileBytes = (await this.handle.stat()).size;
    this.sessionFiles.push(filePath);
    await pruneLogFiles(this.directory, {
      maxFiles: this.maxFiles,
      maxTotalBytes: this.maxTotalBytes,
      maxAgeMs: this.maxAgeMs,
      nowMs: this.now().getTime(),
      preserve: filePath,
    });
    return this.handle;
  }

  private async rotate(): Promise<void> {
    const handle = this.handle;
    this.handle = undefined;
    if (handle !== undefined) await handle.close();
    this.segment += 1;
    this.fileBytes = 0;
  }

  private reportWriteFailure(error: unknown): void {
    const failure = toError(error);
    this.firstFailure ??= failure;
    if (this.writeFailureReported) return;
    this.writeFailureReported = true;
    console.error(`[valemarket] local logging failed: ${failure.message}`);
  }

  private async existingSessionFiles(): Promise<string[]> {
    const marker = `-${this.sessionId}-`;
    const names = await readdir(this.directory);
    const existing: string[] = [];
    for (const name of names.sort()) {
      if (!name.endsWith(".jsonl") || !name.includes(marker)) continue;
      const file = path.join(this.directory, name);
      try {
        if ((await stat(file)).isFile()) existing.push(file);
      } catch {}
    }
    return existing;
  }
}

export function errorLogFields(error: unknown): LogFields {
  const failure = toError(error);
  return {
    errorName: failure.name,
    errorMessage: failure.message,
    ...(failure.stack === undefined ? {} : { errorStack: failure.stack }),
    ...(failure.cause === undefined ? {} : { errorCause: summarizeCause(failure.cause) }),
  };
}

function summarizeCause(cause: unknown): unknown {
  if (!(cause instanceof Error)) return sanitizeValue(cause);
  return {
    name: cause.name,
    message: redactString(cause.message),
    ...(cause.stack === undefined ? {} : { stack: redactString(cause.stack) }),
    ...(cause.cause === undefined ? {} : { cause: summarizeCause(cause.cause) }),
  };
}


function sanitizeValue(value: unknown, key = "", depth = 0, seen = new WeakSet<object>()): unknown {
  if (SENSITIVE_KEYS[key.toLowerCase()] === true) return "[REDACTED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return null;
  if (depth >= 6) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 32).map((entry) => sanitizeValue(entry, "", depth + 1, seen));
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value).slice(0, 64)) {
    result[entryKey] = sanitizeValue(entryValue, entryKey, depth + 1, seen);
  }
  seen.delete(value);
  return result;
}

function redactString(value: string): string {
  return value
    .slice(0, 8_000)
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{43}\b/g, "[REDACTED]");
}

function filenameTimestamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === "string" ? error : JSON.stringify(error));
}

interface PruneOptions {
  maxFiles: number;
  maxTotalBytes: number;
  maxAgeMs: number;
  nowMs: number;
  preserve?: string;
}

async function pruneLogFiles(directory: string, options: PruneOptions): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
    .map(async (entry) => {
      const filePath = path.join(directory, entry.name);
      const details = await stat(filePath);
      return { path: filePath, mtimeMs: details.mtimeMs, size: details.size };
    }));
  files.sort((left, right) => right.mtimeMs - left.mtimeMs || right.path.localeCompare(left.path));
  let kept = 0;
  let keptBytes = 0;
  for (const file of files) {
    const preserved = file.path === options.preserve;
    const expired = options.nowMs - file.mtimeMs > options.maxAgeMs;
    const exceedsBounds = kept >= options.maxFiles || keptBytes + file.size > options.maxTotalBytes;
    if (!preserved && (expired || exceedsBounds)) {
      await rm(file.path, { force: true });
      continue;
    }
    kept += 1;
    keptBytes += file.size;
  }
}

async function pruneExportDirectories(directory: string, keep: number): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("valemarket-diagnostics-"))
    .map(async (entry) => {
      const exportPath = path.join(directory, entry.name);
      return { path: exportPath, mtimeMs: (await stat(exportPath)).mtimeMs };
    }));
  directories.sort((left, right) => right.mtimeMs - left.mtimeMs || right.path.localeCompare(left.path));
  await Promise.all(directories.slice(Math.max(0, keep)).map((entry) => rm(entry.path, { recursive: true, force: true })));
}
