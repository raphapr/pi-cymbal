import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildOutlineArgs, OutlineParams, type OutlineArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerOutlineTool(pi: ExtensionAPI): void {
  registerCymbalTool<OutlineArgs>(pi, {
    name: "cymbal_outline",
    label: "Cymbal Outline",
    description: "Inspect symbols defined in files with Cymbal using `cymbal outline`.",
    parameters: OutlineParams,
    buildArgs: buildOutlineArgs,
    promptSnippet: "cymbal_outline: Inspect file structure with Cymbal before reading full files.",
    promptGuidelines: ["Use cymbal_outline before reading a whole local code file when file structure is enough."],
  });
}
