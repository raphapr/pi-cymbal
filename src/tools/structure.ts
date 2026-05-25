import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildStructureArgs, StructureParams, type StructureArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerStructureTool(pi: ExtensionAPI): void {
  registerCymbalTool<StructureArgs>(pi, {
    name: "cymbal_structure",
    label: "Cymbal Structure",
    description: "Summarize repository structure with Cymbal using `cymbal structure`.",
    parameters: StructureParams,
    buildArgs: buildStructureArgs,
    availabilityCommand: "structure",
    promptSnippet: "cymbal_structure: Summarize repository modules, files, and symbols using Cymbal structure.",
    promptGuidelines: ["Use cymbal_structure for a concise structural overview before deeper symbol navigation."],
  });
}
