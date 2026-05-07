import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildImplsArgs, ImplsParams, type ImplsArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerImplsTool(pi: ExtensionAPI): void {
  registerCymbalTool<ImplsArgs>(pi, {
    name: "cymbal_impls",
    label: "Cymbal Impls",
    description: "Find implementations or interface relationships with `cymbal impls`.",
    parameters: ImplsParams,
    buildArgs: buildImplsArgs,
    promptSnippet: "cymbal_impls: Find implementations and interface relationships through Cymbal.",
    promptGuidelines: ["Use cymbal_impls before changing implementation or interface relationships."],
  });
}
