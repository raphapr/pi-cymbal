import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CymbalError, ProcessError, runCymbal, type OutputFormat, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import { cymbalToolRenderers } from "../render.js";
import type { ToolContext } from "./common.js";
import { normalizeEmptyCymbalNotFound, recoverCymbalNotFound } from "./recovery.js";
import {
  buildContextArgs,
  buildInvestigateArgs,
  buildTraceArgs,
  ContextParams,
  InvestigateParams,
  TraceParams,
  type ContextArgs,
  type InvestigateArgs,
  type TraceArgs,
  effectiveOutputFormat,
} from "../params.js";

export type OptionalRunner = (options: { cwd: string; args: string[]; timeoutMs?: number; signal?: AbortSignal }) => Promise<RunCymbalResult>;

export class UnsupportedCymbalCommandError extends Error {
  constructor(
    readonly command: string,
    readonly diagnostics: string[],
    readonly result: RunCymbalResult,
  ) {
    super(`The installed Cymbal version does not support \`cymbal ${command}\`. Use documented Cymbal tools instead.`);
    this.name = "UnsupportedCymbalCommandError";
  }
}

const availabilityCache = new Map<string, Promise<void>>();
let runnerSequence = 0;
let runnerIds = new WeakMap<OptionalRunner, number>();

function runnerId(runner: OptionalRunner): number {
  let id = runnerIds.get(runner);
  if (id === undefined) {
    id = ++runnerSequence;
    runnerIds.set(runner, id);
  }
  return id;
}

export function clearAvailabilityCache(): void {
  availabilityCache.clear();
  runnerIds = new WeakMap();
  runnerSequence = 0;
}

function diagnosticLines(error: ProcessError): string[] {
  return [error.result.stderr, error.result.stdout, error.message]
    .filter(Boolean)
    .flatMap((value) => value.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function isUnsupportedCommandError(error: unknown, command: string): error is ProcessError {
  if (!(error instanceof ProcessError)) return false;
  const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return diagnosticLines(error).some((line) => new RegExp(`unknown command(?:\\s+|:\\s*)['\"]?${escaped}(?:['\"]|\\b)`, "i").test(line));
}

function isInterruptedPreflight(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof ProcessError)) return false;

  const messages = [error.message];
  if (error instanceof CymbalError && error.cause instanceof ProcessError) messages.push(error.cause.message);
  return error.result.code === 124 || messages.some((message) => /aborted|timed out/i.test(message));
}

export function ensureCommandAvailable(command: string, runner: OptionalRunner = runCymbal, cwd = process.cwd(), signal?: AbortSignal): Promise<void> {
  const key = `${runnerId(runner)}\u0000${cwd}\u0000${command}`;
  const cached = availabilityCache.get(key);
  if (cached) return cached;

  const probe = (async () => {
    try {
      await runner({ cwd, args: [command, "--help"], timeoutMs: 5_000, signal });
    } catch (error) {
      if (isInterruptedPreflight(error, signal)) throw error;
      if (isUnsupportedCommandError(error, command)) {
        throw new UnsupportedCymbalCommandError(command, diagnosticLines(error), error.result);
      }
      throw error;
    }
  })();
  availabilityCache.set(key, probe);
  void probe.catch(() => {
    if (availabilityCache.get(key) === probe) availabilityCache.delete(key);
  });
  return probe;
}

interface OptionalSpec<Params extends { format?: OutputFormat }> {
  name: string;
  label: string;
  command: string;
  description: string;
  parameters: unknown;
  buildArgs: (params: Params) => string[];
  recoverTarget: (params: Params) => string | undefined;
  outputFormat?: (params: Params) => OutputFormat;
}

export function unsupportedCommandResult(error: UnsupportedCymbalCommandError, cwd: string, format: OutputFormat): RunCymbalResult {
  const diagnostics = error.diagnostics;
  return {
    ...error.result,
    command: `cymbal ${error.command} --help`,
    args: [error.command, "--help"],
    cwd,
    stdout: format === "json"
      ? JSON.stringify({ results: {}, status: "unsupported", command: error.command, diagnostics })
      : `${error.message}\n${diagnostics.join("\n")}\n`,
    stderr: "",
    code: error.result.code || 1,
    status: "unsupported",
    diagnostics,
  };
}

function registerOptionalTool<Params extends { format?: OutputFormat }>(pi: ExtensionAPI, spec: OptionalSpec<Params>): void {
  pi.registerTool(
    defineTool({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: spec.parameters as never,
      promptSnippet: `${spec.name}: Optional Cymbal ${spec.command} helper. It checks command availability first.`,
      promptGuidelines: [`Use ${spec.name} only when Cymbal supports the ${spec.command} command.`],
      ...cymbalToolRenderers(spec.name),
      async execute(_toolCallId, params: Params, signal, _onUpdate, ctx: ToolContext) {
        const runner = ctx.runCymbal ?? runCymbal;
        const format = spec.outputFormat?.(params) ?? params.format ?? "agent";
        try {
          await ensureCommandAvailable(spec.command, runner, ctx.cwd, signal);
        } catch (error) {
          if (!(error instanceof UnsupportedCymbalCommandError)) throw error;
          return await formatCymbalOutput({ result: unsupportedCommandResult(error, ctx.cwd, format), format });
        }

        const args = spec.buildArgs(params);
        try {
          const result = normalizeEmptyCymbalNotFound(await runner({ cwd: ctx.cwd, args, signal }), format);
          return await formatCymbalOutput({ result, format });
        } catch (error) {
          const recovered = recoverCymbalNotFound(error, { cwd: ctx.cwd, args, requestedTarget: spec.recoverTarget(params), format });
          if (!recovered) throw error;
          return await formatCymbalOutput({ result: recovered, format });
        }
      },
    }),
  );
}

export function registerOptionalTools(pi: ExtensionAPI): void {
  registerOptionalTool<InvestigateArgs>(pi, {
    name: "cymbal_investigate",
    label: "Cymbal Investigate",
    command: "investigate",
    description: "Run optional guide-mentioned `cymbal investigate <symbol>` when supported by the installed Cymbal version.",
    parameters: InvestigateParams,
    buildArgs: buildInvestigateArgs,
    recoverTarget: (params) => params.symbol ?? params.symbols?.join(" "),
  });
  registerOptionalTool<TraceArgs>(pi, {
    name: "cymbal_trace",
    label: "Cymbal Trace",
    command: "trace",
    description: "Run optional guide-mentioned `cymbal trace <symbol>` when supported by the installed Cymbal version.",
    parameters: TraceParams,
    buildArgs: buildTraceArgs,
    recoverTarget: (params) => params.symbol ?? params.symbols?.join(" "),
    outputFormat: effectiveOutputFormat,
  });
  registerOptionalTool<ContextArgs>(pi, {
    name: "cymbal_context",
    label: "Cymbal Context",
    command: "context",
    description: "Run optional guide-mentioned `cymbal context <symbol>` when supported by the installed Cymbal version.",
    parameters: ContextParams,
    buildArgs: buildContextArgs,
    recoverTarget: (params) => params.symbol,
  });
}
