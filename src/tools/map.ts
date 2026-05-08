import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildMapArgs, MapParams, type MapArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerMapTool(pi: ExtensionAPI): void {
  registerCymbalTool<MapArgs>(pi, {
    name: "cymbal_map",
    label: "Cymbal Map",
    description: "Map Git repository structure with Cymbal using `cymbal ls`. Requires cwd to be inside a Git repository.",
    parameters: MapParams,
    buildArgs: buildMapArgs,
    promptSnippet: "cymbal_map: Repo overview using Cymbal. Requires the current directory to be inside a Git repository.",
    promptGuidelines: [
      "Use cymbal_map first when the relevant local repository area is unknown.",
      "If Cymbal reports no repo detected, fall back to local find/grep tools instead of retrying Cymbal.",
    ],
  });
}
