import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildRefsArgs, RefsParams, type RefsArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerRefsTool(pi: ExtensionAPI): void {
  registerCymbalTool<RefsArgs>(pi, {
    name: "cymbal_refs",
    label: "Cymbal Refs",
    description: "Find references, importers, or shallow impact for a symbol with `cymbal refs`.",
    parameters: RefsParams,
    buildArgs: buildRefsArgs,
    promptSnippet: "cymbal_refs: Find references, importers, or impact for a symbol using Cymbal.",
    promptGuidelines: ["Use cymbal_refs before changing symbol references."],
  });
}
