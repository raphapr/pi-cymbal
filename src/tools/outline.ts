import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCymbal, type OutputFormat, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput, type CymbalToolResult } from "../output.js";
import { buildOutlineArgs, OutlineParams, type OutlineArgs } from "../params.js";
import type { ToolContext } from "./common.js";
import { resolveMultiPathRun } from "./path.js";
import { normalizeEmptyCymbalNotFound, recoverCymbalNotFound } from "./recovery.js";

export function resolveOutlineRun(params: OutlineArgs, cwd: string) {
  return resolveMultiPathRun(params, cwd, params.files, (next, files) => ({ ...next, files }));
}

function combinedStatus(results: CymbalToolResult[]): "ok" | "partial" | "not_found" | "empty" | "error" {
  const statuses = results.map((result) => result.details.status);
  if (statuses.every((status) => status === "ok")) return "ok";
  if (statuses.every((status) => status === "not_found")) return "not_found";
  if (statuses.every((status) => status === "empty")) return "empty";
  if (statuses.some((status) => status === "ok")) return "partial";
  if (statuses.some((status) => status === "not_found" || status === "empty")) return "partial";
  return "error";
}

function diagnostics(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasEmptyOutline(result: RunCymbalResult): boolean {
  return result.code === 0 && result.stdout.trim() === "" && /No symbols found\. Is the file indexed\?/i.test(result.stderr);
}

function emptyOutlineResult(result: RunCymbalResult, target: string, format: OutputFormat | undefined): RunCymbalResult {
  const lines = diagnostics(result.stderr);
  const stdout =
    format === "json"
      ? `${JSON.stringify({ results: {}, diagnostics: lines, status: "empty" })}\n`
      : `No Cymbal outline symbols resolved for \`${target}\`.\n\n${lines.join("\n")}\n`;

  return {
    ...result,
    stdout,
    stderr: "",
    status: "empty",
    requestedTarget: target,
    diagnostics: lines,
  };
}

function normalizeOutlineResult(result: RunCymbalResult, target: string, format: OutputFormat | undefined): RunCymbalResult {
  const normalized = normalizeEmptyCymbalNotFound(result, format);
  if (normalized !== result) return normalized;
  return hasEmptyOutline(result) ? emptyOutlineResult(result, target, format) : result;
}

export function registerOutlineTool(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "cymbal_outline",
      label: "Cymbal Outline",
      description: "Inspect symbols defined in one or more files with Cymbal using `cymbal outline`.",
      parameters: OutlineParams,
      promptSnippet: "cymbal_outline: Inspect file structure with Cymbal before reading full files.",
      promptGuidelines: ["Use cymbal_outline before reading a whole local code file when file structure is enough."],
      async execute(_toolCallId, params: OutlineArgs, signal, _onUpdate, ctx: ToolContext) {
        const runner = ctx.runCymbal ?? runCymbal;
        const formatted = [];
        const commands = [];

        for (const file of params.files) {
          const run = resolveOutlineRun({ ...params, files: [file] }, ctx.cwd);
          const scopedFile = run.params.files[0];
          const args = buildOutlineArgs({ files: [scopedFile], names: params.names, signatures: params.signatures, format: params.format });
          try {
            const result = normalizeOutlineResult(await runner({ cwd: run.cwd, args, signal }), scopedFile, params.format);
            commands.push({ command: result.command, args: result.args, exitCode: result.code });
            formatted.push(await formatCymbalOutput({ result, format: params.format ?? "agent" }));
          } catch (error) {
            const recovered = recoverCymbalNotFound(error, { cwd: run.cwd, args, requestedTarget: scopedFile, format: params.format });
            if (!recovered) throw error;
            commands.push({ command: recovered.command, args: recovered.args, exitCode: recovered.code });
            formatted.push(await formatCymbalOutput({ result: recovered, format: params.format ?? "agent" }));
          }
        }

        if (formatted.length === 1) return formatted[0];

        return {
          content: [
            {
              type: "text",
              text: formatted
                .map((result, index) => `## ${params.files[index]}\n\n${result.content[0]?.text ?? ""}`)
                .join("\n\n---\n\n"),
            },
          ],
          details: {
            outputFormat: params.format ?? "agent",
            status: combinedStatus(formatted),
            commands,
            results: formatted.map((result) => result.details),
          },
        };
      },
    }),
  );
}
