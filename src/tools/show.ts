import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildShowArgs, ShowParams, type ShowArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerShowTool(pi: ExtensionAPI): void {
  registerCymbalTool<ShowArgs>(pi, {
    name: "cymbal_show",
    label: "Cymbal Show",
    description: "Read source by symbol, file, or file range with Cymbal using `cymbal show`.",
    parameters: ShowParams,
    buildArgs: buildShowArgs,
    promptSnippet: "cymbal_show: Read a symbol, file, or file range using Cymbal.",
    promptGuidelines: ["Use cymbal_show for targeted local reads by symbol or line range."],
  });
}
