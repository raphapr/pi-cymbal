import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OutputFormat } from "../cymbal.js";
import { runCymbal } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import { cymbalToolRenderers } from "../render.js";
import { ensureCommandAvailable, unsupportedCommandResult, UnsupportedCymbalCommandError } from "./optional.js";
import { normalizeEmptyCymbalNotFound, recoverCymbalNotFound } from "./recovery.js";

export interface ToolContext {
  cwd: string;
  runCymbal?: typeof runCymbal;
}

export interface ResolvedToolRun<Params> {
  cwd: string;
  params: Params;
}

export interface CymbalToolSpec<Params extends { format?: OutputFormat }> {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  buildArgs: (params: Params) => string[];
  resolveRun?: (params: Params, cwd: string) => ResolvedToolRun<Params>;
  recoverTarget?: (params: Params, args: string[]) => string | undefined;
  availabilityCommand?: string;
  outputFormat?: (params: Params) => OutputFormat;
  promptSnippet: string;
  promptGuidelines: string[];
}

export function registerCymbalTool<Params extends { format?: OutputFormat }>(pi: ExtensionAPI, spec: CymbalToolSpec<Params>): void {
  pi.registerTool(
    defineTool({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: spec.parameters as never,
      promptSnippet: spec.promptSnippet,
      promptGuidelines: spec.promptGuidelines,
      ...cymbalToolRenderers(spec.name),
      async execute(_toolCallId, params: Params, signal, _onUpdate, ctx: ToolContext) {
        const run = spec.resolveRun?.(params, ctx.cwd) ?? { cwd: ctx.cwd, params };
        const args = spec.buildArgs(run.params);
        const format = spec.outputFormat?.(run.params) ?? run.params.format ?? "agent";
        const runner = ctx.runCymbal ?? runCymbal;
        if (spec.availabilityCommand) {
          try {
            await ensureCommandAvailable(spec.availabilityCommand, runner, run.cwd, signal);
          } catch (error) {
            if (!(error instanceof UnsupportedCymbalCommandError)) throw error;
            return await formatCymbalOutput({ result: unsupportedCommandResult(error, run.cwd, format), format });
          }
        }
        try {
          const result = normalizeEmptyCymbalNotFound(await runner({ cwd: run.cwd, args, signal }), format);
          return await formatCymbalOutput({ result, format });
        } catch (error) {
          const recovered = recoverCymbalNotFound(error, {
            cwd: run.cwd,
            args,
            requestedTarget: spec.recoverTarget?.(run.params, args),
            format,
          });
          if (!recovered) throw error;
          return await formatCymbalOutput({ result: recovered, format });
        }
      },
    }),
  );
}
