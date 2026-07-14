import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { accessSync, constants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createBoundedCapture,
  DEFAULT_CAPTURE_MAX_BYTES,
  type BoundedCapture,
  type BoundedCaptureResult,
  type CaptureFileSystem,
} from "./spill.js";

export type OutputFormat = "agent" | "json";

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  exists?: (path: string) => boolean;
  executable?: (path: string) => boolean;
  platform?: NodeJS.Platform;
}

export interface ProcessOperations {
  platform: NodeJS.Platform;
  killProcessGroup(pid: number, signal: NodeJS.Signals): void;
  taskkill(pid: number): Promise<boolean>;
  killChild(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): boolean;
}

export interface RunProcessOptions {
  bin: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  input?: string;
  captureMaxBytes?: number;
  captureFs?: CaptureFileSystem;
  processOperations?: Partial<ProcessOperations>;
  terminationGraceMs?: number;
}

export interface RunCymbalOptions {
  cwd: string;
  args: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  input?: string;
  captureMaxBytes?: number;
}

export type CymbalResultStatus = "ok" | "not_found" | "unsupported" | "no_repo" | "error" | "partial" | "empty";

export interface RunCymbalResult {
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  code: number;
  stdoutBytes?: number;
  stderrBytes?: number;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  stdoutPath?: string;
  stderrPath?: string;
  status?: CymbalResultStatus;
  diagnostics?: string[];
  suggestions?: string[];
  requestedTarget?: string;
  resolvedCwd?: string;
  resolvedTarget?: string;
}

export class ProcessError extends Error {
  constructor(
    message: string,
    readonly result: RunCymbalResult,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProcessError";
  }
}

export class ProcessCwdError extends ProcessError {
  constructor(message: string, result: RunCymbalResult, cause?: unknown) {
    super(message, result, cause);
    this.name = "ProcessCwdError";
  }
}

export class ProcessBinaryError extends ProcessError {
  constructor(message: string, result: RunCymbalResult, cause?: unknown) {
    super(message, result, cause);
    this.name = "ProcessBinaryError";
  }
}

export class ProcessCaptureError extends ProcessError {
  constructor(message: string, result: RunCymbalResult, cause?: unknown) {
    super(message, result, cause);
    this.name = "ProcessCaptureError";
  }
}

export class ProcessTimeoutError extends ProcessError {
  constructor(message: string, result: RunCymbalResult, cause?: unknown) {
    super(message, result, cause);
    this.name = "ProcessTimeoutError";
  }
}

export class CymbalError extends ProcessError {
  constructor(message: string, result: RunCymbalResult, cause?: unknown) {
    super(message, result, cause);
    this.name = "CymbalError";
  }
}

export function resolveCymbalBinary(options: ResolveOptions = {}): string {
  const env = options.env ?? process.env;
  const configured = env.CYMBAL_BIN?.trim();
  if (configured) return configured;

  const home = options.home ?? homedir();
  const exists = options.exists ?? existsSync;
  const local = join(home, ".local", "bin", "cymbal");
  const platform = options.platform ?? process.platform;
  const executable = options.executable ?? ((path: string) => {
    if (options.exists) return exists(path);
    try {
      accessSync(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  if (platform === "win32" ? exists(local) : executable(local)) return local;

  return "cymbal";
}

export function normalizePathArg(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

export function buildCymbalEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return {
    ...base,
    CYMBAL_NO_UPDATE_NOTIFIER: "1",
    NO_COLOR: "1",
    TERM: "dumb",
  };
}

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function formatCommand(bin: string, args: string[]): string {
  return [bin, ...args].map(shellQuote).join(" ");
}

export function missingCymbalMessage(): string {
  return [
    "Cymbal is unavailable because the `cymbal` command was not found.",
    "Install Cymbal, set CYMBAL_BIN, add ~/.local/bin/cymbal, or put cymbal on PATH.",
  ].join("\n");
}

export function isNoRepoDetected(result: Pick<RunCymbalResult, "stderr" | "stdout">): boolean {
  const output = `${result.stderr}\n${result.stdout}`;
  return output.includes("not inside a git repository") || output.includes("no repo detected");
}

export function noRepoDetectedMessage(result: Pick<RunCymbalResult, "cwd">): string {
  return [
    "pi-cymbal requires the current working directory to be inside a Git repository.",
    `Current cwd: ${result.cwd}`,
    "This extension intentionally relies on Cymbal's Git repo auto-detection and does not pass --db.",
    "Use local file tools for non-Git directories, or run Pi from inside a Git repository.",
  ].join("\n");
}

function emptyResult(command: string, options: Pick<RunProcessOptions, "args" | "cwd">, code = 1): RunCymbalResult {
  return { command, args: [...options.args], cwd: options.cwd, stdout: "", stderr: "", code };
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted", "AbortError");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function defaultTaskkill(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    killer.once("error", () => resolve(false));
    killer.once("close", (code) => resolve(code === 0));
  });
}

function processOperations(overrides: Partial<ProcessOperations> | undefined): ProcessOperations {
  return {
    platform: overrides?.platform ?? process.platform,
    killProcessGroup: overrides?.killProcessGroup ?? ((pid, signal) => process.kill(-pid, signal)),
    taskkill: overrides?.taskkill ?? defaultTaskkill,
    killChild: overrides?.killChild ?? ((child, signal) => child.kill(signal)),
  };
}

export async function runProcess(options: RunProcessOptions): Promise<RunCymbalResult> {
  const command = formatCommand(options.bin, options.args);
  try {
    if (!statSync(options.cwd).isDirectory()) throw new Error("not a directory");
  } catch (error) {
    throw new ProcessCwdError(`Cannot run ${command}: cwd is unavailable or not a directory: ${options.cwd}`, emptyResult(command, options), error);
  }

  if (options.signal?.aborted) throw abortReason(options.signal);

  const maxBytes = options.captureMaxBytes ?? DEFAULT_CAPTURE_MAX_BYTES;
  const ops = processOperations(options.processOperations);
  const graceMs = options.terminationGraceMs ?? 100;
  const captures: BoundedCapture[] = [];

  try {
    const stdoutSink = createBoundedCapture({ label: "stdout.txt", maxBytes, fs: options.captureFs });
    captures.push(stdoutSink);
    const stderrSink = createBoundedCapture({ label: "stderr.txt", maxBytes, fs: options.captureFs });
    captures.push(stderrSink);
    return await new Promise<RunCymbalResult>((resolve, reject) => {
      const child = spawn(options.bin, options.args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        stdio: ["pipe", "pipe", "pipe"],
        detached: ops.platform !== "win32",
        windowsHide: true,
      });

      let closeCode: number | null = null;
      let spawnError: NodeJS.ErrnoException | undefined;
      let terminalError: unknown;
      let captureError: unknown;
      let terminalCause: "capture" | "spawn" | "terminal" | "timeout" | undefined;
      let termination: Promise<void> | undefined;
      let timer: NodeJS.Timeout | undefined;

      const terminateTree = (): Promise<void> => {
        if (termination) return termination;
        termination = (async () => {
          const pid = child.pid;
          if (!pid) return;
          if (ops.platform === "win32") {
            const killed = await ops.taskkill(pid);
            if (!killed) ops.killChild(child, "SIGKILL");
            return;
          }
          try {
            ops.killProcessGroup(pid, "SIGTERM");
          } catch {
            ops.killChild(child, "SIGTERM");
          }
          await delay(graceMs);
          try {
            ops.killProcessGroup(pid, "SIGKILL");
          } catch {
            if (closeCode === null) ops.killChild(child, "SIGKILL");
          }
        })();
        return termination;
      };

      const recordCaptureError = (error: unknown): void => {
        captureError ??= error;
        terminalCause ??= "capture";
        void terminateTree();
      };

      function closeCapture(capture: BoundedCapture): BoundedCaptureResult {
        try {
          return capture.close();
        } catch (error) {
          recordCaptureError(error);
          return { text: "", bytes: 0, truncated: false };
        }
      }

      let stdoutResult: BoundedCaptureResult | undefined;
      let stderrResult: BoundedCaptureResult | undefined;
      const closeStdoutCapture = (): void => {
        stdoutResult ??= closeCapture(stdoutSink);
      };
      const closeStderrCapture = (): void => {
        stderrResult ??= closeCapture(stderrSink);
      };

      function appendCapture(capture: BoundedCapture, chunk: Buffer): void {
        try {
          capture.append(chunk);
        } catch (error) {
          recordCaptureError(error);
        }
      }

      child.stdout.on("data", (chunk: Buffer) => appendCapture(stdoutSink, chunk));
      child.stderr.on("data", (chunk: Buffer) => appendCapture(stderrSink, chunk));
      child.stdout.on("error", recordCaptureError);
      child.stderr.on("error", recordCaptureError);
      child.stdout.once("end", closeStdoutCapture);
      child.stderr.once("end", closeStderrCapture);

      function recordTerminalError(error: unknown): void {
        if (terminalCause === undefined) {
          terminalError = error;
          terminalCause = "terminal";
        }
        void terminateTree();
      }

      child.stdin.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EPIPE" || error.code === "ERR_STREAM_DESTROYED") return;
        recordTerminalError(error);
      });

      const onAbort = (): void => {
        recordTerminalError(abortReason(options.signal!));
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });

      if (options.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          terminalCause ??= "timeout";
          void terminateTree();
        }, options.timeoutMs);
        timer.unref();
      }

      child.once("error", (error: NodeJS.ErrnoException) => {
        spawnError = error;
        terminalCause ??= "spawn";
      });

      async function settle(code: number | null): Promise<void> {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener("abort", onAbort);
        if (termination) await termination;

        closeStdoutCapture();
        closeStderrCapture();
        if (termination) await termination;
        const stdout = stdoutResult!;
        const stderr = stderrResult!;

        const exitCode = terminalCause === "timeout" ? 124 : (code ?? (spawnError?.code === "ENOENT" ? 127 : 1));
        const result: RunCymbalResult = {
          command,
          args: [...options.args],
          cwd: options.cwd,
          stdout: stdout.text,
          stderr: stderr.text,
          code: exitCode,
          stdoutBytes: stdout.bytes,
          stderrBytes: stderr.bytes,
          stdoutTruncated: stdout.truncated,
          stderrTruncated: stderr.truncated,
          stdoutPath: stdout.path,
          stderrPath: stderr.path,
        };

        switch (terminalCause) {
          case "terminal":
            reject(terminalError);
            return;
          case "capture":
            reject(new ProcessCaptureError(`${command} output capture failed`, result, captureError));
            return;
          case "timeout":
            reject(new ProcessTimeoutError(`${command} timed out`, result));
            return;
          case "spawn": {
            const ErrorType = spawnError?.code === "ENOENT" ? ProcessBinaryError : ProcessError;
            reject(new ErrorType(spawnError?.message ?? `${command} failed to spawn`, result, spawnError));
            return;
          }
        }
        if (exitCode !== 0) {
          reject(new ProcessError(`${command} failed (exit ${exitCode})`, result));
          return;
        }
        resolve(result);
      }

      child.once("close", (code) => {
        closeCode = code;
        void settle(code).catch(reject);
      });

      child.stdin.end(options.input);
    });
  } catch (error) {
    for (const capture of captures) {
      try {
        capture.close();
      } catch {
        // Preserve the original process or capture failure.
      }
    }
    throw error;
  }
}

let sessionController: AbortController | undefined;
const activeCymbalOperations = new Set<Promise<RunCymbalResult>>();

export function startCymbalSession(): void {
  sessionController?.abort(new DOMException("Cymbal session replaced", "AbortError"));
  sessionController = new AbortController();
}

export function abortCymbalSession(reason: unknown = new DOMException("Cymbal session shut down", "AbortError")): void {
  sessionController?.abort(reason);
}

export function cymbalSessionSignal(signal?: AbortSignal): AbortSignal | undefined {
  const sessionSignal = sessionController?.signal;
  if (!sessionSignal) return signal;
  return signal ? AbortSignal.any([signal, sessionSignal]) : sessionSignal;
}

async function executeCymbal(options: RunCymbalOptions): Promise<RunCymbalResult> {
  const bin = resolveCymbalBinary();
  try {
    return await runProcess({
      bin,
      args: options.args,
      cwd: options.cwd,
      env: buildCymbalEnv(),
      signal: cymbalSessionSignal(options.signal),
      timeoutMs: options.timeoutMs,
      input: options.input,
      captureMaxBytes: options.captureMaxBytes,
    });
  } catch (error) {
    if (error instanceof ProcessCwdError) throw error;
    if (error instanceof ProcessError) {
      if (error instanceof ProcessBinaryError) {
        throw new CymbalError(missingCymbalMessage(), error.result, error);
      }
      if (isNoRepoDetected(error.result)) {
        throw new CymbalError(noRepoDetectedMessage(error.result), error.result, error);
      }
      const text = [
        `${error.result.command} failed (exit ${error.result.code}).`,
        error.result.stdout ? `stdout:\n${error.result.stdout}` : undefined,
        error.result.stderr ? `stderr:\n${error.result.stderr}` : undefined,
        error.result.stdoutPath ? `Full stdout: ${error.result.stdoutPath}` : undefined,
        error.result.stderrPath ? `Full stderr: ${error.result.stderrPath}` : undefined,
      ]
        .filter(Boolean)
        .join("\n\n");
      throw new CymbalError(text, error.result, error);
    }
    throw error;
  }
}

export async function runCymbal(options: RunCymbalOptions): Promise<RunCymbalResult> {
  const operation = executeCymbal(options);
  activeCymbalOperations.add(operation);
  try {
    return await operation;
  } finally {
    activeCymbalOperations.delete(operation);
  }
}

export async function waitForCymbalOperations(): Promise<void> {
  while (activeCymbalOperations.size) {
    await Promise.allSettled([...activeCymbalOperations]);
    await Promise.resolve();
  }
}

export async function commandExists(command: string, cwd: string): Promise<boolean> {
  try {
    await runCymbal({ cwd, args: [command, "--help"], timeoutMs: 5_000 });
    return true;
  } catch {
    return false;
  }
}
