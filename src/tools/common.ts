import { defineTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OutputFormat } from "../cymbal.js";
import { runCymbal } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";

export interface ToolContext {
  cwd: string;
}

export interface CymbalToolSpec<Params extends { format?: OutputFormat }> {
  name: string;
  label: string;
  description: string;
  parameters: unknown;
  buildArgs: (params: Params) => string[];
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
      async execute(_toolCallId, params: Params, signal, _onUpdate, ctx) {
        const args = spec.buildArgs(params);
        const result = await runCymbal({ cwd: ctx.cwd, args, signal });
        return await formatCymbalOutput({ result, format: params.format ?? "agent" });
      },
    }),
  );
}
