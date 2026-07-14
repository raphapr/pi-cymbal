import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCymbal, type OutputFormat, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalBatch, formatCymbalOutput, type CymbalBatchItem } from "../output.js";
import { buildOutlineArgs, OutlineParams, type OutlineArgs } from "../params.js";
import { cymbalToolRenderers } from "../render.js";
import type { ToolContext } from "./common.js";
import { resolveMultiPathRun } from "./path.js";
import { normalizeEmptyCymbalNotFound, recoverCymbalNotFound } from "./recovery.js";

export function resolveOutlineRun(params: OutlineArgs, cwd: string) {
  return resolveMultiPathRun(params, cwd, params.files, (next, files) => ({ ...next, files }), { classification: "always" });
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
      ...cymbalToolRenderers("cymbal_outline"),
      async execute(_toolCallId, params: OutlineArgs, signal, _onUpdate, ctx: ToolContext) {
        if (params.files.length < 1 || params.files.length > 32) throw new RangeError("files must contain between 1 and 32 paths");
        const runner = ctx.runCymbal ?? runCymbal;
        const items: CymbalBatchItem[] = [];

        for (const file of params.files) {
          const run = resolveOutlineRun({ ...params, files: [file] }, ctx.cwd);
          const scopedFile = run.params.files[0];
          const args = buildOutlineArgs({ files: [scopedFile], names: params.names, signatures: params.signatures, format: params.format });
          try {
            const result = normalizeOutlineResult(await runner({ cwd: run.cwd, args, signal }), scopedFile, params.format);
            items.push({ target: file, result });
          } catch (error) {
            const recovered = recoverCymbalNotFound(error, { cwd: run.cwd, args, requestedTarget: scopedFile, format: params.format });
            if (!recovered) throw error;
            items.push({ target: file, result: recovered });
          }
        }

        if (items.length === 1) return await formatCymbalOutput({ result: items[0].result, format: params.format ?? "agent" });
        return await formatCymbalBatch({ items, format: params.format ?? "agent" });
      },
    }),
  );
}
