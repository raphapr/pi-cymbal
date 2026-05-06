import { defineTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { CymbalError, runCymbal, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import {
  buildContextArgs,
  buildInvestigateArgs,
  buildTraceArgs,
  OptionalSymbolParams,
  type OptionalSymbolArgs,
} from "../params.js";

export type OptionalRunner = (options: { cwd: string; args: string[]; timeoutMs?: number }) => Promise<RunCymbalResult>;

export async function ensureCommandAvailable(command: string, runner: OptionalRunner = runCymbal, cwd = process.cwd()): Promise<void> {
  try {
    await runner({ cwd, args: [command, "--help"], timeoutMs: 5_000 });
  } catch (error) {
    if (error instanceof CymbalError && (error.result.code === 127 || error.message.includes("Cymbal is unavailable"))) {
      throw error;
    }
    throw new Error(`The installed Cymbal version does not support \`cymbal ${command}\`. Use documented Cymbal tools instead.`);
  }
}

interface OptionalSpec {
  name: string;
  label: string;
  command: string;
  description: string;
  buildArgs: (params: OptionalSymbolArgs) => string[];
}

function registerOptionalTool(pi: ExtensionAPI, spec: OptionalSpec): void {
  pi.registerTool(
    defineTool({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      parameters: OptionalSymbolParams,
      promptSnippet: `${spec.name}: Optional Cymbal ${spec.command} helper. It checks command availability first.`,
      promptGuidelines: [`Use ${spec.name} only when Cymbal supports the ${spec.command} command.`],
      async execute(_toolCallId, params: OptionalSymbolArgs, signal, _onUpdate, ctx) {
        await ensureCommandAvailable(spec.command, runCymbal, ctx.cwd);
        const args = spec.buildArgs(params);
        const result = await runCymbal({ cwd: ctx.cwd, args, signal });
        return await formatCymbalOutput({ result, format: params.format ?? "agent" });
      },
    }),
  );
}

export function registerOptionalTools(pi: ExtensionAPI): void {
  registerOptionalTool(pi, {
    name: "cymbal_investigate",
    label: "Cymbal Investigate",
    command: "investigate",
    description: "Run optional guide-mentioned `cymbal investigate <symbol>` when supported by the installed Cymbal version.",
    buildArgs: buildInvestigateArgs,
  });
  registerOptionalTool(pi, {
    name: "cymbal_trace",
    label: "Cymbal Trace",
    command: "trace",
    description: "Run optional guide-mentioned `cymbal trace <symbol>` when supported by the installed Cymbal version.",
    buildArgs: buildTraceArgs,
  });
  registerOptionalTool(pi, {
    name: "cymbal_context",
    label: "Cymbal Context",
    command: "context",
    description: "Run optional guide-mentioned `cymbal context <symbol>` when supported by the installed Cymbal version.",
    buildArgs: buildContextArgs,
  });
}
