import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildMapArgs, MapParams, type MapArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerMapTool(pi: ExtensionAPI): void {
  registerCymbalTool<MapArgs>(pi, {
    name: "cymbal_map",
    label: "Cymbal Map",
    description: "Map repository structure with Cymbal using `cymbal ls`. Use before choosing files or search terms.",
    parameters: MapParams,
    buildArgs: buildMapArgs,
    promptSnippet: "cymbal_map: Repo overview using Cymbal. Supports path, depth, stats, repos, and format.",
    promptGuidelines: ["Use cymbal_map first when the relevant local repository area is unknown."],
  });
}
