import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildIndexArgs, IndexParams, type IndexArgs } from "../params.js";
import { registerCymbalTool, type ResolvedToolRun } from "./common.js";
import { resolveSinglePathRun } from "./path.js";

export function resolveIndexRun(params: IndexArgs, cwd: string): ResolvedToolRun<IndexArgs> {
  return resolveSinglePathRun(params, cwd, params.path, (next, path) => ({ ...next, path }), { omitRepoRoot: true, classification: "always" });
}

export function registerIndexTool(pi: ExtensionAPI): void {
  registerCymbalTool<IndexArgs>(pi, {
    name: "cymbal_index",
    label: "Cymbal Index",
    description:
      "Refresh Cymbal's local index cache with `cymbal index`. Use only when index freshness is suspected or explicitly requested; this is cache-mutating but local-only.",
    parameters: IndexParams,
    buildArgs: buildIndexArgs,
    resolveRun: resolveIndexRun,
    availabilityCommand: "index",
    promptSnippet:
      "cymbal_index: Refresh Cymbal's local index cache. Use only when index freshness is suspected or explicitly requested; local cache mutation only.",
    promptGuidelines: [
      "Use cymbal_index only when a stale index is suspected or the user explicitly asks to refresh indexing.",
      "Do not use cymbal_index for routine navigation because Cymbal auto-indexes repositories.",
    ],
  });
}
