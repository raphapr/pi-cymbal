import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isNoRepoDetected, ProcessError, runCymbal, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import { buildSearchArgs, SearchParams, type SearchArgs } from "../params.js";
import { cymbalToolRenderers } from "../render.js";
import { resolvePathFilterRun, type RepoRootFs } from "./path.js";

interface SearchRun {
  cwd: string;
  params: SearchArgs;
}

function withScopedFilter(params: SearchArgs, key: "path" | "exclude", value: string | string[] | undefined): SearchArgs {
  const next = { ...params };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function resolveSearchRun(params: SearchArgs, cwd: string, fs?: RepoRootFs): SearchRun {
  return resolvePathFilterRun(params, cwd, {
    path: params.path,
    exclude: params.exclude,
    applyPath: (next, value) => withScopedFilter(next, "path", value),
    applyExclude: (next, value) => withScopedFilter(next, "exclude", value),
    fs,
    errorPrefix: "cymbal_search",
  });
}

export function noResultsSearchResult(error: unknown, format?: "agent" | "json"): RunCymbalResult | undefined {
  if (!(error instanceof ProcessError)) return undefined;

  if (isNoRepoDetected(error.result)) return undefined;

  const visibleOutput = [error.result.stdout, error.result.stderr].filter(Boolean).join("");
  if (!/no results found/i.test(visibleOutput)) return undefined;

  return {
    ...error.result,
    stdout: format === "json" ? '{"results":[]}\n' : visibleOutput || "No results found.\n",
    stderr: "",
    status: "not_found",
    diagnostics: visibleOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

export function registerSearchTool(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "cymbal_search",
      label: "Cymbal Search",
      description: "Search symbols or full text with Cymbal using `cymbal search`.",
      parameters: SearchParams,
      promptSnippet: "cymbal_search: Search symbols or text with Cymbal. Prefer before broad grep for local code.",
      promptGuidelines: ["Use cymbal_search before broad local grep when looking for symbols or text in a repository."],
      ...cymbalToolRenderers("cymbal_search"),
      async execute(_toolCallId, params: SearchArgs, signal, _onUpdate, ctx) {
        const run = resolveSearchRun(params, ctx.cwd);
        const args = buildSearchArgs(run.params);
        let result: RunCymbalResult;
        try {
          result = await runCymbal({ cwd: run.cwd, args, signal });
        } catch (error) {
          const noResults = noResultsSearchResult(error, params.format);
          if (!noResults) throw error;
          result = noResults;
        }
        return await formatCymbalOutput({ result, format: params.format ?? "agent" });
      },
    }),
  );
}
