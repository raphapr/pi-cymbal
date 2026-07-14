import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildImportersArgs, effectiveOutputFormat, ImportersParams, type ImportersArgs } from "../params.js";
import { registerCymbalTool, type ResolvedToolRun } from "./common.js";
import { resolveSinglePathRun } from "./path.js";

export function resolveImportersRun(params: ImportersArgs, cwd: string): ResolvedToolRun<ImportersArgs> {
  return resolveSinglePathRun(params, cwd, params.target, (next, target) => ({ ...next, target: target ?? next.target }), { classification: "importer" });
}

export function registerImportersTool(pi: ExtensionAPI): void {
  registerCymbalTool<ImportersArgs>(pi, {
    name: "cymbal_importers",
    label: "Cymbal Importers",
    description: "Find files that import a file or package with `cymbal importers`.",
    parameters: ImportersParams,
    buildArgs: buildImportersArgs,
    resolveRun: resolveImportersRun,
    outputFormat: effectiveOutputFormat,
    recoverTarget: (params) => params.target,
    promptSnippet: "cymbal_importers: Find import relationships through Cymbal.",
    promptGuidelines: ["Use cymbal_importers before changing file or package import relationships."],
  });
}
