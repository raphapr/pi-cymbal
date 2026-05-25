import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CymbalError, ProcessError, runCymbal, type OutputFormat, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
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
} from "../params.js";

export type OptionalRunner = (options: { cwd: string; args: string[]; timeoutMs?: number; signal?: AbortSignal }) => Promise<RunCymbalResult>;

function isInterruptedPreflight(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!(error instanceof ProcessError)) return false;

  const messages = [error.message];
  if (error instanceof CymbalError && error.cause instanceof ProcessError) messages.push(error.cause.message);
  return error.result.code === 124 || messages.some((message) => /aborted|timed out/i.test(message));
}

export async function ensureCommandAvailable(command: string, runner: OptionalRunner = runCymbal, cwd = process.cwd(), signal?: AbortSignal): Promise<void> {
  try {
    await runner({ cwd, args: [command, "--help"], timeoutMs: 5_000, signal });
  } catch (error) {
    if (isInterruptedPreflight(error, signal)) throw error;
    if (error instanceof CymbalError && (error.result.code === 127 || error.message.includes("Cymbal is unavailable"))) {
      throw error;
    }
    if (error instanceof ProcessError && !(error instanceof CymbalError)) throw error;
    throw new Error(`The installed Cymbal version does not support \`cymbal ${command}\`. Use documented Cymbal tools instead.`);
  }
}

interface OptionalSpec<Params extends { format?: OutputFormat }> {
  name: string;
  label: string;
  command: string;
  description: string;
  parameters: unknown;
  buildArgs: (params: Params) => string[];
  recoverTarget: (params: Params) => string | undefined;
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
      async execute(_toolCallId, params: Params, signal, _onUpdate, ctx: ToolContext) {
        const runner = ctx.runCymbal ?? runCymbal;
        await ensureCommandAvailable(spec.command, runner, ctx.cwd, signal);
        const args = spec.buildArgs(params);
        try {
          const result = normalizeEmptyCymbalNotFound(await runner({ cwd: ctx.cwd, args, signal }), params.format);
          return await formatCymbalOutput({ result, format: params.format ?? "agent" });
        } catch (error) {
          const recovered = recoverCymbalNotFound(error, { cwd: ctx.cwd, args, requestedTarget: spec.recoverTarget(params), format: params.format });
          if (!recovered) throw error;
          return await formatCymbalOutput({ result: recovered, format: params.format ?? "agent" });
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
