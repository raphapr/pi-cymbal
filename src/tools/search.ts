import { existsSync, statSync, type Stats } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { ProcessError, runCymbal, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput } from "../output.js";
import { buildSearchArgs, SearchParams, type SearchArgs } from "../params.js";

interface SearchRun {
  cwd: string;
  params: SearchArgs;
}

type StatDirectoryCheck = Pick<Stats, "isDirectory">;

interface SearchFs {
  stat: (path: string) => StatDirectoryCheck;
  exists: (path: string) => boolean;
}

const defaultFs: SearchFs = {
  stat: statSync,
  exists: existsSync,
};

function asArray(path?: string | string[]): string[] {
  if (!path) return [];
  return Array.isArray(path) ? path : [path];
}

function isDirectory(path: string, fs: SearchFs): boolean {
  try {
    return fs.stat(path).isDirectory();
  } catch {
    return false;
  }
}

function findRepoRoot(path: string, fs: SearchFs): string | undefined {
  let current = isDirectory(path, fs) ? path : dirname(path);

  for (;;) {
    if (fs.exists(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function scopedPathValue(paths: string[]): string | string[] | undefined {
  if (!paths.length) return undefined;
  return paths.length === 1 ? paths[0] : paths;
}

function absoluteValues(params: SearchArgs): string[] {
  return [...asArray(params.path), ...asArray(params.exclude)].filter((path) => isAbsolute(path));
}

function scopeFilterValue(value: string | string[] | undefined, repoRoot: string, omitRepoRoot: boolean): string | string[] | undefined {
  const scoped = asArray(value)
    .map((path) => {
      if (!isAbsolute(path)) return path;
      const scopedPath = relative(repoRoot, path) || ".";
      return omitRepoRoot && scopedPath === "." ? undefined : scopedPath;
    })
    .filter((path): path is string => Boolean(path));

  return scopedPathValue(scoped);
}

function withScopedFilter(params: SearchArgs, key: "path" | "exclude", value: string | string[] | undefined): SearchArgs {
  const next = { ...params };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function resolveSearchRun(params: SearchArgs, cwd: string, fs: SearchFs = defaultFs): SearchRun {
  const absoluteFilters = absoluteValues(params);
  if (!absoluteFilters.length) return { cwd, params };

  const repoRoots = absoluteFilters.map((path) => findRepoRoot(path, fs));
  const repoRoot = repoRoots[0];
  if (repoRoot && repoRoots.every((root) => root === repoRoot)) {
    const scopedPath = scopeFilterValue(params.path, repoRoot, true);
    const scopedExclude = scopeFilterValue(params.exclude, repoRoot, false);
    const scopedParams = withScopedFilter(withScopedFilter(params, "path", scopedPath), "exclude", scopedExclude);
    return { cwd: repoRoot, params: scopedParams };
  }

  const paths = asArray(params.path);
  if (paths.length === 1 && isAbsolute(paths[0]) && isDirectory(paths[0], fs)) {
    const { path: _path, ...scopedParams } = params;
    return { cwd: paths[0], params: scopedParams };
  }

  return { cwd, params };
}

export function noResultsSearchResult(error: unknown, format?: "agent" | "json"): RunCymbalResult | undefined {
  if (!(error instanceof ProcessError)) return undefined;

  const visibleOutput = [error.result.stdout, error.result.stderr].filter(Boolean).join("");
  if (!/no results found/i.test(visibleOutput)) return undefined;

  return {
    ...error.result,
    stdout: format === "json" ? '{"results":[]}\n' : visibleOutput || "No results found.\n",
    stderr: "",
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
