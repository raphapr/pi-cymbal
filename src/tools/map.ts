import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildMapArgs, MapParams, type MapArgs } from "../params.js";
import { registerCymbalTool, type ResolvedToolRun } from "./common.js";
import { resolveSinglePathRun } from "./path.js";

export function resolveMapRun(params: MapArgs, cwd: string): ResolvedToolRun<MapArgs> {
  if (params.repos || params.names) return { cwd, params };
  return resolveSinglePathRun(params, cwd, params.path, (next, path) => ({ ...next, path }), { omitRepoRoot: true, classification: "always" });
}

export function registerMapTool(pi: ExtensionAPI): void {
  registerCymbalTool<MapArgs>(pi, {
    name: "cymbal_map",
    label: "Cymbal Map",
    description: "Map Git repository structure or list indexed files with Cymbal using `cymbal ls`. Use names with an optional pattern and lang for the code inventory after index skip rules. Requires cwd to be inside a Git repository.",
    parameters: MapParams,
    buildArgs: buildMapArgs,
    resolveRun: resolveMapRun,
    promptSnippet: "cymbal_map: Repo overview or indexed file inventory (names: true) using Cymbal. Requires the current directory to be inside a Git repository.",
    promptGuidelines: [
      "Use cymbal_map first when the relevant local repository area is unknown.",
      "Use cymbal_map with names: true and an optional pattern or lang to list indexed code files. Use find for exact filesystem globs or non-code files.",
      "If Cymbal reports no repo detected, fall back to local find/grep tools instead of retrying Cymbal.",
    ],
  });
}
