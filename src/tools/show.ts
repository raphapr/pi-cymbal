import { isAbsolute } from "node:path";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { normalizePathArg, runCymbal, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalOutput, type CymbalToolResult } from "../output.js";
import { buildShowArgs, ShowParams, type ShowArgs } from "../params.js";
import type { ToolContext } from "./common.js";
import { findRepoRoot, resolveMultiPathRun, resolvePathFilterRun, resolveSinglePathRun, splitPathRangeSuffix, type RepoRootFs } from "./path.js";
import { recoverCymbalNotFound } from "./recovery.js";

function showTargets(params: ShowArgs): string[] {
  const targets = params.targets ?? [];
  if (params.target && targets.length) throw new Error("target and targets cannot be combined");
  if (params.target) return [params.target];
  if (targets.length) return targets;
  throw new Error("target or targets is required");
}

function withScopedFilter(params: ShowArgs, key: "path" | "exclude", value: string | string[] | undefined): ShowArgs {
  const next = { ...params };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

function targetRepoRoot(targets: string[], fs?: RepoRootFs): string | undefined {
  const absolutePaths = targets.map(absolutePathTarget).filter((target): target is string => Boolean(target));
  if (!absolutePaths.length) return undefined;
  const roots = absolutePaths.map((target) => findRepoRoot(target, fs));
  const root = roots[0];
  return root && roots.every((candidate) => candidate === root) ? root : undefined;
}

export function resolveShowRun(params: ShowArgs, cwd: string, fs?: RepoRootFs) {
  const targets = showTargets(params);
  const targetRoot = targetRepoRoot(targets, fs);
  const targetRun = params.targets?.length
    ? resolveMultiPathRun(params, cwd, params.targets, (next, values) => ({ ...next, targets: values }), { fs })
    : resolveSinglePathRun(params, cwd, params.target, (next, target) => ({ ...next, target }), { fs });

  return resolvePathFilterRun(targetRun.params, targetRun.cwd, {
    path: targetRun.params.path,
    exclude: targetRun.params.exclude,
    applyPath: (next, value) => withScopedFilter(next, "path", value),
    applyExclude: (next, value) => withScopedFilter(next, "exclude", value),
    targetRepoRoot: targetRoot,
    fs,
    errorPrefix: "cymbal_show",
  });
}

function absolutePathTarget(target: string): string | undefined {
  const path = splitPathRangeSuffix(normalizePathArg(target)).path;
  return isAbsolute(path) ? path : undefined;
}

function validateJsonTargetScope(targets: string[], cwd: string): void {
  const absolutePaths = targets.map(absolutePathTarget).filter((target): target is string => Boolean(target));
  if (!absolutePaths.length) return;

  const repoRoots = absolutePaths.map((target) => findRepoRoot(target));
  const uniqueRepoRoots = new Set(repoRoots.filter((root): root is string => Boolean(root)));
  if (uniqueRepoRoots.size > 1 || repoRoots.some((root) => !root)) {
    throw new Error("cymbal_show cannot combine cross-repo or no-repo JSON targets; split them into separate calls.");
  }

  const [repoRoot] = uniqueRepoRoots;
  if (!repoRoot) return;

  const hasNonAbsoluteTargets = absolutePaths.length < targets.length;
  if (hasNonAbsoluteTargets && findRepoRoot(cwd) !== repoRoot) {
    throw new Error("cymbal_show cannot combine mixed-scope JSON targets; split them into separate calls.");
  }
}

function combinedStatus(results: CymbalToolResult[]): "ok" | "partial" | "not_found" | "error" {
  const statuses = results.map((result) => result.details.status);
  if (statuses.every((status) => status === "ok")) return "ok";
  if (statuses.every((status) => status === "not_found")) return "not_found";
  if (statuses.some((status) => status === "ok")) return "partial";
  return "error";
}

function showJsonStatus(stdout: string): "partial" | "not_found" | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || !("results" in parsed)) return undefined;
  const results = (parsed as { results?: unknown }).results;
  if (!results || typeof results !== "object" || Array.isArray(results)) return undefined;

  const entries = Object.values(results);
  if (!entries.length) return undefined;

  const errorCount = entries.filter((entry) => Boolean(entry && typeof entry === "object" && "error" in entry)).length;
  if (!errorCount) return undefined;
  return errorCount === entries.length ? "not_found" : "partial";
}

function normalizeShowJsonResult(result: RunCymbalResult, format: ShowArgs["format"]): RunCymbalResult {
  if (format !== "json") return result;
  const status = showJsonStatus(result.stdout);
  return status ? { ...result, status } : result;
}

async function showWithParams(params: ShowArgs, signal: AbortSignal | undefined, ctx: ToolContext): Promise<CymbalToolResult> {
  const runner = ctx.runCymbal ?? runCymbal;
  const run = resolveShowRun(params, ctx.cwd);
  const args = buildShowArgs(run.params);

  try {
    const result = normalizeShowJsonResult(await runner({ cwd: run.cwd, args, signal }), params.format);
    return await formatCymbalOutput({ result, format: params.format ?? "agent" });
  } catch (error) {
    const requestedTarget = run.params.target ?? run.params.targets?.join(" ");
    const recovered = recoverCymbalNotFound(error, { cwd: run.cwd, args, requestedTarget, format: params.format });
    if (!recovered) throw error;
    return await formatCymbalOutput({ result: recovered, format: params.format ?? "agent" });
  }
}

async function showOne(target: string, params: ShowArgs, signal: AbortSignal | undefined, ctx: ToolContext): Promise<CymbalToolResult> {
  return await showWithParams({ ...params, target, targets: undefined }, signal, ctx);
}

export function registerShowTool(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "cymbal_show",
      label: "Cymbal Show",
      description: "Read source by symbol, file, or file range with Cymbal using `cymbal show`.",
      parameters: ShowParams,
      promptSnippet: "cymbal_show: Read one or more symbols, files, or file ranges using Cymbal.",
      promptGuidelines: ["Use cymbal_show for targeted local reads by symbol or line range."],
      async execute(_toolCallId, params: ShowArgs, signal, _onUpdate, ctx: ToolContext) {
        const targets = showTargets(params);
        const results = [];

        // Validate the `targets[]` JSON form even when only one element is supplied,
        // so a single absolute no-repo target rejects with the same diagnostic as larger batches.
        if (params.format === "json" && params.targets) {
          validateJsonTargetScope(targets, ctx.cwd);
        }

        if (targets.length === 1) return await showOne(targets[0], params, signal, ctx);
        if (params.format === "json") {
          return await showWithParams({ ...params, target: undefined, targets }, signal, ctx);
        }

        for (const target of targets) {
          results.push(await showOne(target, params, signal, ctx));
        }

        return {
          content: [
            {
              type: "text",
              text: results
                .map((result, index) => `## ${targets[index]}\n\n${result.content[0]?.text ?? ""}`)
                .join("\n\n---\n\n"),
            },
          ],
          details: {
            outputFormat: params.format ?? "agent",
            status: combinedStatus(results),
            results: results.map((result) => result.details),
          },
        };
      },
    }),
  );
}
