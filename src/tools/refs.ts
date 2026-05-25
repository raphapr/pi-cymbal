import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildRefsArgs, RefsParams, type RefsArgs } from "../params.js";
import { registerCymbalTool, type ResolvedToolRun } from "./common.js";
import { resolvePathFilterRun } from "./path.js";

function withScopedFilter(params: RefsArgs, key: "path" | "exclude", value: string | string[] | undefined): RefsArgs {
  const next = { ...params };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function resolveRefsRun(params: RefsArgs, cwd: string): ResolvedToolRun<RefsArgs> {
  return resolvePathFilterRun(params, cwd, {
    path: params.path,
    exclude: params.exclude,
    applyPath: (next, value) => withScopedFilter(next, "path", value),
    applyExclude: (next, value) => withScopedFilter(next, "exclude", value),
    errorPrefix: "cymbal_refs",
  });
}

export function registerRefsTool(pi: ExtensionAPI): void {
  registerCymbalTool<RefsArgs>(pi, {
    name: "cymbal_refs",
    label: "Cymbal Refs",
    description: "Find references, importers, or shallow impact for a symbol with `cymbal refs`.",
    parameters: RefsParams,
    buildArgs: buildRefsArgs,
    resolveRun: resolveRefsRun,
    promptSnippet: "cymbal_refs: Find references, importers, or impact for a symbol using Cymbal.",
    promptGuidelines: ["Use cymbal_refs before changing symbol references."],
  });
}
