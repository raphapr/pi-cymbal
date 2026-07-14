import { isAbsolute } from "node:path";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { normalizePathArg, runCymbal, type RunCymbalResult } from "../cymbal.js";
import { formatCymbalBatch, formatCymbalOutput, type CymbalBatchItem, type CymbalToolResult } from "../output.js";
import { buildShowArgs, ShowParams, type ShowArgs } from "../params.js";
import { cymbalToolRenderers } from "../render.js";
import type { ToolContext } from "./common.js";
import { findRepoRoot, repoRootKey, resolveMultiPathRun, resolvePathFilterRun, resolvePathOperand, resolveSinglePathRun, splitPathRangeSuffix, type RepoRootFs } from "./path.js";
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

function targetRepoRoot(targets: string[], cwd: string, fs?: RepoRootFs): string | undefined {
  const resolved = targets.map((target) => resolvePathOperand(target, cwd, "show", fs));
  const absolutePaths = resolved.map(absolutePathTarget).filter((target): target is string => Boolean(target));
  if (!absolutePaths.length) return undefined;
  const roots = absolutePaths.map((target) => findRepoRoot(target, fs)).filter((root): root is string => Boolean(root));
  const root = roots[0];
  if (!root) return undefined;
  const key = repoRootKey(root, fs);
  return roots.every((candidate) => repoRootKey(candidate, fs) === key) ? root : undefined;
}

export function resolveShowRun(params: ShowArgs, cwd: string, fs?: RepoRootFs) {
  const targets = showTargets(params);
  const targetRoot = targetRepoRoot(targets, cwd, fs);
  const targetRun = params.targets?.length
    ? resolveMultiPathRun(params, cwd, params.targets, (next, values) => ({ ...next, targets: values }), { fs, classification: "show" })
    : resolveSinglePathRun(params, cwd, params.target, (next, target) => ({ ...next, target }), { fs, classification: "show" });

  return resolvePathFilterRun(targetRun.params, cwd, {
    path: params.path,
    exclude: params.exclude,
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
  const resolved = targets.map((target) => resolvePathOperand(target, cwd, "show"));
  const absolutePaths = resolved.map(absolutePathTarget).filter((target): target is string => Boolean(target));
  if (!absolutePaths.length) return;

  const repoRoots = absolutePaths.map((target) => findRepoRoot(target));
  const keys = new Set(repoRoots.filter((root): root is string => Boolean(root)).map((root) => repoRootKey(root)));
  if (keys.size > 1 || repoRoots.some((root) => !root)) {
    throw new Error("cymbal_show cannot combine cross-repo or no-repo JSON targets; split them into separate calls.");
  }
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

async function runShowWithParams(params: ShowArgs, signal: AbortSignal | undefined, ctx: ToolContext): Promise<RunCymbalResult> {
  const runner = ctx.runCymbal ?? runCymbal;
  const run = resolveShowRun(params, ctx.cwd);
  const args = buildShowArgs(run.params);

  try {
    return normalizeShowJsonResult(await runner({ cwd: run.cwd, args, signal }), params.format);
  } catch (error) {
    const requestedTarget = run.params.target ?? run.params.targets?.join(" ");
    const recovered = recoverCymbalNotFound(error, { cwd: run.cwd, args, requestedTarget, format: params.format });
    if (!recovered) throw error;
    return recovered;
  }
}

async function showWithParams(params: ShowArgs, signal: AbortSignal | undefined, ctx: ToolContext): Promise<CymbalToolResult> {
  const result = await runShowWithParams(params, signal, ctx);
  return await formatCymbalOutput({ result, format: params.format ?? "agent" });
}

async function showOneResult(target: string, params: ShowArgs, signal: AbortSignal | undefined, ctx: ToolContext): Promise<RunCymbalResult> {
  return await runShowWithParams({ ...params, target, targets: undefined }, signal, ctx);
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
      ...cymbalToolRenderers("cymbal_show"),
      async execute(_toolCallId, params: ShowArgs, signal, _onUpdate, ctx: ToolContext) {
        const targets = showTargets(params);

        // Validate the `targets[]` JSON form even when only one element is supplied,
        // so a single absolute no-repo target rejects with the same diagnostic as larger batches.
        if (params.format === "json" && params.targets) {
          validateJsonTargetScope(targets, ctx.cwd);
        }

        if (targets.length === 1) {
          const result = await showOneResult(targets[0], params, signal, ctx);
          return await formatCymbalOutput({ result, format: params.format ?? "agent" });
        }
        if (params.format === "json") {
          return await showWithParams({ ...params, target: undefined, targets }, signal, ctx);
        }

        const items: CymbalBatchItem[] = [];
        for (const target of targets) {
          items.push({ target, result: await showOneResult(target, params, signal, ctx) });
        }
        return await formatCymbalBatch({ items, format: "agent" });
      },
    }),
  );
}
