import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildImportersArgs, ImportersParams, type ImportersArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerImportersTool(pi: ExtensionAPI): void {
  registerCymbalTool<ImportersArgs>(pi, {
    name: "cymbal_importers",
    label: "Cymbal Importers",
    description: "Find files that import a file or package with `cymbal importers`.",
    parameters: ImportersParams,
    buildArgs: buildImportersArgs,
    promptSnippet: "cymbal_importers: Find import relationships through Cymbal.",
    promptGuidelines: ["Use cymbal_importers before changing file or package import relationships."],
  });
}
