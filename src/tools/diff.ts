import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildDiffArgs, DiffParams, type DiffArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerDiffTool(pi: ExtensionAPI): void {
  registerCymbalTool<DiffArgs>(pi, {
    name: "cymbal_diff",
    label: "Cymbal Diff",
    description: "Review symbol-scoped changes with Cymbal using `cymbal diff`.",
    parameters: DiffParams,
    buildArgs: buildDiffArgs,
    recoverTarget: (params) => params.symbol,
    availabilityCommand: "diff",
    promptSnippet: "cymbal_diff: Review symbol-scoped diffs using Cymbal diff.",
    promptGuidelines: ["Use cymbal_diff when reviewing changes to a specific local symbol."],
  });
}
