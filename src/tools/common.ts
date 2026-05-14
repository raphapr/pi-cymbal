import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { OutputFormat } from "../cymbal.js";
import { runCymbal } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
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
      async execute(_toolCallId, params: Params, signal, _onUpdate, ctx: ToolContext) {
        const run = spec.resolveRun?.(params, ctx.cwd) ?? { cwd: ctx.cwd, params };
        const args = spec.buildArgs(run.params);
        const runner = ctx.runCymbal ?? runCymbal;
        try {
          const result = normalizeEmptyCymbalNotFound(await runner({ cwd: run.cwd, args, signal }), params.format);
          return await formatCymbalOutput({ result, format: params.format ?? "agent" });
        } catch (error) {
          const recovered = recoverCymbalNotFound(error, {
            cwd: run.cwd,
            args,
            requestedTarget: spec.recoverTarget?.(run.params, args),
            format: params.format,
          });
          if (!recovered) throw error;
          return await formatCymbalOutput({ result: recovered, format: params.format ?? "agent" });
        }
      },
    }),
  );
}
