import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { buildImplsArgs, ImplsParams, type ImplsArgs } from "../params.js";
import { registerCymbalTool, type ResolvedToolRun } from "./common.js";
import { resolvePathFilterRun } from "./path.js";

function withScopedFilter(params: ImplsArgs, key: "path" | "exclude", value: string | string[] | undefined): ImplsArgs {
  const next = { ...params };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function resolveImplsRun(params: ImplsArgs, cwd: string): ResolvedToolRun<ImplsArgs> {
  return resolvePathFilterRun(params, cwd, {
    path: params.path,
    exclude: params.exclude,
    applyPath: (next, value) => withScopedFilter(next, "path", value),
    applyExclude: (next, value) => withScopedFilter(next, "exclude", value),
    errorPrefix: "cymbal_impls",
  });
}

export function registerImplsTool(pi: ExtensionAPI): void {
  registerCymbalTool<ImplsArgs>(pi, {
    name: "cymbal_impls",
    label: "Cymbal Impls",
    description: "Find implementations or interface relationships with `cymbal impls`.",
    parameters: ImplsParams,
    buildArgs: buildImplsArgs,
    resolveRun: resolveImplsRun,
    promptSnippet: "cymbal_impls: Find implementations and interface relationships through Cymbal.",
    promptGuidelines: ["Use cymbal_impls before changing implementation or interface relationships."],
  });
}
