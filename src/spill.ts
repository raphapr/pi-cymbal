import {
  closeSync,
  mkdtempSync,
  openSync,
  rmSync,
  writeSync,
  type PathLike,
} from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CAPTURE_MAX_BYTES = 256 * 1024;

export interface CaptureFileSystem {
  open(path: PathLike, flags: string, mode?: number): number;
  write(fd: number, buffer: Uint8Array): number;
  close(fd: number): void;
}

const defaultCaptureFs: CaptureFileSystem = {
  open: (path, flags, mode) => openSync(path, flags, mode),
  write: (fd, buffer) => writeSync(fd, buffer),
  close: closeSync,
};

export interface BoundedCaptureResult {
  text: string;
  bytes: number;
  truncated: boolean;
  path?: string;
}

export interface BoundedCapture {
  append(chunk: Uint8Array): void;
  close(): BoundedCaptureResult;
}

let spillRoot: string | undefined;
let spillSequence = 0;
let acceptingSpills = true;
const spillPaths = new Set<string>();
const activeFinalizers = new Set<Promise<unknown>>();

export function startSpillSession(): void {
  acceptingSpills = true;
}

export function stopSpillSession(): void {
  acceptingSpills = false;
}

function ensureSpillRoot(): string {
  if (!acceptingSpills) throw new Error("Cymbal spill creation is disabled during session shutdown");
  spillRoot ??= mkdtempSync(join(tmpdir(), "pi-cymbal-"));
  return spillRoot;
}

function nextSpillPath(label: string): string {
  const path = join(ensureSpillRoot(), `${String(++spillSequence).padStart(4, "0")}-${label}`);
  spillPaths.add(path);
  return path;
}

function writeAll(fs: CaptureFileSystem, fd: number, buffer: Uint8Array): void {
  let offset = 0;
  while (offset < buffer.byteLength) {
    const written = fs.write(fd, buffer.subarray(offset));
    if (!Number.isInteger(written) || written <= 0) throw new Error("Spill write made no progress");
    offset += written;
  }
}

function decodeUtf8Prefix(buffer: Buffer): string {
  for (let trim = 0; trim <= Math.min(3, buffer.byteLength); trim += 1) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, buffer.byteLength - trim));
    } catch {
      // A byte ceiling may split the final code point. Drop only that incomplete suffix.
    }
  }
  return buffer.toString("utf8");
}

export function createBoundedCapture(options: {
  label: string;
  maxBytes?: number;
  fs?: CaptureFileSystem;
}): BoundedCapture {
  const maxBytes = options.maxBytes ?? DEFAULT_CAPTURE_MAX_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes < 0) throw new RangeError("capture maxBytes must be a non-negative integer");

  const fs = options.fs ?? defaultCaptureFs;
  const preview: Buffer[] = [];
  let previewBytes = 0;
  let totalBytes = 0;
  let path: string | undefined;
  let fd: number | undefined;
  let closed = false;
  let failure: unknown;
  let resolveFinalizer: (() => void) | undefined;
  trackSpillFinalizer(new Promise<void>((resolve) => {
    resolveFinalizer = resolve;
  }));

  function finishFinalizer(): void {
    const finalize = resolveFinalizer;
    resolveFinalizer = undefined;
    finalize?.();
  }

  function activateSpill(): void {
    path = nextSpillPath(options.label);
    try {
      fd = fs.open(path, "wx", 0o600);
      for (const chunk of preview) writeAll(fs, fd, chunk);
    } catch (error) {
      spillPaths.delete(path);
      failure = error;
      throw error;
    }
  }

  function captureResult(): BoundedCaptureResult {
    return { text: decodeUtf8Prefix(Buffer.concat(preview)), bytes: totalBytes, truncated: Boolean(path), path };
  }

  return {
    append(chunkValue: Uint8Array): void {
      if (closed) throw new Error("Capture is already closed");
      if (failure) throw failure;
      const chunk = Buffer.from(chunkValue);
      totalBytes += chunk.byteLength;

      if (fd === undefined && totalBytes > maxBytes) activateSpill();

      if (previewBytes < maxBytes) {
        const retained = chunk.subarray(0, Math.min(chunk.byteLength, maxBytes - previewBytes));
        if (retained.byteLength) {
          preview.push(retained);
          previewBytes += retained.byteLength;
        }
      }

      if (fd !== undefined) {
        try {
          writeAll(fs, fd, chunk);
        } catch (error) {
          failure = error;
          throw error;
        }
      }
    },

    close(): BoundedCaptureResult {
      if (closed) {
        if (failure) throw failure;
        return captureResult();
      }
      closed = true;
      try {
        if (fd !== undefined) {
          try {
            fs.close(fd);
          } catch (error) {
            failure ??= error;
          } finally {
            fd = undefined;
          }
        }
        if (failure) throw failure;
        return captureResult();
      } finally {
        finishFinalizer();
      }
    },
  };
}

export function writeManagedSpill(content: string | Uint8Array, label = "output.txt"): Promise<string> {
  const path = nextSpillPath(label);
  const operation = (async () => {
    try {
      await writeFile(path, content, { flag: "wx", mode: 0o600 });
      return path;
    } catch (error) {
      spillPaths.delete(path);
      throw error;
    }
  })();
  return trackSpillFinalizer(operation);
}

export function trackSpillFinalizer<T>(promise: Promise<T>): Promise<T> {
  activeFinalizers.add(promise);
  void promise.finally(() => activeFinalizers.delete(promise)).catch(() => undefined);
  return promise;
}

export async function waitForSpillFinalizers(): Promise<void> {
  const failures: unknown[] = [];
  while (activeFinalizers.size) {
    const results = await Promise.allSettled([...activeFinalizers]);
    for (const result of results) {
      if (result.status === "rejected") failures.push(result.reason);
    }
    await Promise.resolve();
  }
  if (failures.length) throw new AggregateError(failures, "Cymbal spill finalization failed");
}

export async function cleanupSpills(): Promise<void> {
  let finalizerError: unknown;
  try {
    await waitForSpillFinalizers();
  } catch (error) {
    finalizerError = error;
  } finally {
    if (spillRoot) {
      const root = spillRoot;
      spillRoot = undefined;
      spillPaths.clear();
      spillSequence = 0;
      rmSync(root, { recursive: true, force: true });
    }
  }
  if (finalizerError) throw finalizerError;
}

export function managedSpillPaths(): string[] {
  return [...spillPaths];
}
