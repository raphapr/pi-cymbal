import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type OutputFormat = "agent" | "json";

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  home?: string;
  exists?: (path: string) => boolean;
}

export interface RunProcessOptions {
  bin: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  input?: string;
}

export interface RunCymbalOptions {
  cwd: string;
  args: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  input?: string;
}

export type CymbalResultStatus = "ok" | "not_found" | "unsupported" | "no_repo" | "error" | "partial" | "empty";

export interface RunCymbalResult {
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  code: number;
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
  if (exists(local)) return local;

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
  return JSON.stringify(value);
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

export async function runProcess(options: RunProcessOptions): Promise<RunCymbalResult> {
  const command = formatCommand(options.bin, options.args);

  if (options.signal?.aborted) {
    throw new ProcessError(`${command} aborted`, {
      command,
      args: [...options.args],
      cwd: options.cwd,
      stdout: "",
      stderr: "",
      code: 1,
    });
  }

  return await new Promise<RunCymbalResult>((resolve, reject) => {
    const child = spawn(options.bin, options.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const cleanup = () => {
      settled = true;
      if (timer) clearTimeout(timer);
      options.signal?.removeEventListener("abort", abortHandler);
    };

    const resultFor = (code: number): RunCymbalResult => ({
      command,
      args: [...options.args],
      cwd: options.cwd,
      stdout,
      stderr,
      code,
    });

    const fail = (error: Error, code = 1, cause?: unknown) => {
      if (settled) return;
      cleanup();
      reject(new ProcessError(error.message, resultFor(code), cause));
    };

    const abortHandler = () => {
      timedOut = true;
      child.kill("SIGTERM");
      fail(new Error(`${command} aborted`), 1);
    };

    const timer = options.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          timedOut = true;
          child.kill("SIGTERM");
          const killTimer = setTimeout(() => child.kill("SIGKILL"), 100);
          killTimer.unref();
          fail(new Error(`${command} timed out`), 124);
        }, options.timeoutMs)
      : undefined;

    options.signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      fail(error, (error as NodeJS.ErrnoException).code === "ENOENT" ? 127 : 1, error);
    });

    child.on("close", (code) => {
      if (settled) return;
      cleanup();
      const exitCode = code ?? (timedOut ? 124 : 1);
      const result = resultFor(exitCode);
      if (timedOut) {
        reject(new ProcessError(`${command} timed out`, { ...result, code: 124 }));
        return;
      }
      if (exitCode !== 0) {
        reject(new ProcessError(`${command} failed (exit ${exitCode})`, result));
        return;
      }
      resolve(result);
    });

    if (options.input !== undefined) {
      child.stdin.end(options.input);
    } else {
      child.stdin.end();
    }
  });
}

export async function runCymbal(options: RunCymbalOptions): Promise<RunCymbalResult> {
  const bin = resolveCymbalBinary();
  try {
    return await runProcess({
      bin,
      args: options.args,
      cwd: options.cwd,
      env: buildCymbalEnv(),
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      input: options.input,
    });
  } catch (error) {
    if (error instanceof ProcessError) {
      const cause = error.cause as NodeJS.ErrnoException | undefined;
      if (cause?.code === "ENOENT" || error.result.code === 127) {
        throw new CymbalError(missingCymbalMessage(), error.result, error);
      }
      if (isNoRepoDetected(error.result)) {
        throw new CymbalError(noRepoDetectedMessage(error.result), error.result, error);
      }
      const text = [
        `${error.result.command} failed (exit ${error.result.code}).`,
        error.result.stdout ? `stdout:\n${error.result.stdout}` : undefined,
        error.result.stderr ? `stderr:\n${error.result.stderr}` : undefined,
      ]
        .filter(Boolean)
        .join("\n\n");
      throw new CymbalError(text, error.result, error);
    }
    throw error;
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
