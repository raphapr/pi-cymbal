import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { buildSearchArgs, SearchParams, type SearchArgs } from "../params.js";
import { registerCymbalTool } from "./common.js";

export function registerSearchTool(pi: ExtensionAPI): void {
  registerCymbalTool<SearchArgs>(pi, {
    name: "cymbal_search",
    label: "Cymbal Search",
    description: "Search symbols or full text with Cymbal using `cymbal search`.",
    parameters: SearchParams,
    buildArgs: buildSearchArgs,
    promptSnippet: "cymbal_search: Search symbols or text with Cymbal. Prefer before broad grep for local code.",
    promptGuidelines: ["Use cymbal_search before broad local grep when looking for symbols or text in a repository."],
  });
}
