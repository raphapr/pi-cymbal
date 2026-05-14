import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildImpactArgs, ImpactParams, type ImpactArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerImpactTool(pi: ExtensionAPI): void {
  registerCymbalTool<ImpactArgs>(pi, {
    name: "cymbal_impact",
    label: "Cymbal Impact",
    description: "Analyze upstream impact for a symbol with `cymbal impact`.",
    parameters: ImpactParams,
    buildArgs: buildImpactArgs,
    promptSnippet: "cymbal_impact: Analyze symbol impact through Cymbal impact.",
    promptGuidelines: ["Use cymbal_impact before changing a local symbol with likely upstream callers."],
  });
}
