import { defineTool, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { runCymbal } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import { buildOutlineArgs, OutlineParams, type OutlineArgs } from "../params.js";

export function registerOutlineTool(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "cymbal_outline",
      label: "Cymbal Outline",
      description: "Inspect symbols defined in one or more files with Cymbal using `cymbal outline`.",
      parameters: OutlineParams,
      promptSnippet: "cymbal_outline: Inspect file structure with Cymbal before reading full files.",
      promptGuidelines: ["Use cymbal_outline before reading a whole local code file when file structure is enough."],
      async execute(_toolCallId, params: OutlineArgs, signal, _onUpdate, ctx) {
        const runner = (ctx as typeof ctx & { runCymbal?: typeof runCymbal }).runCymbal ?? runCymbal;
        const formatted = [];
        const commands = [];

        for (const file of params.files) {
          const args = buildOutlineArgs({ files: [file], signatures: params.signatures, format: params.format });
          const result = await runner({ cwd: ctx.cwd, args, signal });
          commands.push({ command: result.command, args: result.args, exitCode: result.code });
          formatted.push(await formatCymbalOutput({ result, format: params.format ?? "agent" }));
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
            commands,
            results: formatted.map((result) => result.details),
          },
        };
      },
    }),
  );
}
