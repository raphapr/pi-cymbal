import { isNoRepoDetected, ProcessError, type OutputFormat, type RunCymbalResult } from "../cymbal.js";
import { suggestNearbyFiles } from "./path.js";

export interface RecoverCymbalOptions {
  cwd: string;
  args: string[];
  requestedTarget?: string;
  format?: OutputFormat;
}

function visibleOutput(result: Pick<RunCymbalResult, "stdout" | "stderr">): string {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function diagnostics(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isOutsideRepoOutput(output: string): boolean {
  return /refusing to read file outside repository/i.test(output);
}

function isNotFoundOutput(output: string): boolean {
  if (isOutsideRepoOutput(output)) return false;

  return (
    /no results found/i.test(output) ||
    /no references found/i.test(output) ||
    /no implementors found/i.test(output) ||
    /no importers found/i.test(output) ||
    /no callers found/i.test(output) ||
    /no outgoing calls found/i.test(output) ||
    /no changed symbols found/i.test(output) ||
    /file not found/i.test(output) ||
    /symbol not found/i.test(output) ||
    /no requested symbol or file resolved/i.test(output)
  );
}

function buildStatusJson(status: "not_found" | "no_repo", target: string | undefined, suggestions: string[], lines: string[]): string {
  return `${JSON.stringify({ results: {}, status, requestedTarget: target, suggestions, diagnostics: lines })}\n`;
}

function buildNotFoundText(target: string | undefined, suggestions: string[]): string {
  const label = target ? ` for \`${target}\`` : "";
  const lines = [`No Cymbal target resolved${label}.`];

  if (suggestions.length) {
    lines.push("", "Nearby files:");
    for (const suggestion of suggestions) lines.push(`- ${suggestion}`);
  }

  lines.push("", "Try:");
  if (target) lines.push(`- cymbal_search query=${JSON.stringify(target)} text=true`);
  lines.push("- cymbal_map the nearest parent directory");

  return `${lines.join("\n")}\n`;
}

export function normalizeEmptyCymbalNotFound(result: RunCymbalResult, format?: OutputFormat): RunCymbalResult {
  if (result.code !== 0) return result;

  const output = visibleOutput(result);
  const hasRecoverableOutput = result.stdout.trim() === "" || isNotFoundOutput(result.stdout);
  if (!hasRecoverableOutput || (!isNoRepoDetected(result) && !isNotFoundOutput(output))) return result;

  const lines = diagnostics(output);
  const status = isNoRepoDetected(result) ? "no_repo" : "not_found";
  return {
    ...result,
    stdout: format === "json" ? buildStatusJson(status, undefined, [], lines) : `${lines.join("\n")}\n`,
    stderr: "",
    status,
    diagnostics: lines,
  };
}

export function recoverCymbalNotFound(error: unknown, options: RecoverCymbalOptions): RunCymbalResult | undefined {
  if (!(error instanceof ProcessError)) return undefined;

  if (isNoRepoDetected(error.result)) return undefined;

  const output = visibleOutput(error.result);
  if (isOutsideRepoOutput(output) || !isNotFoundOutput(output)) return undefined;

  const requestedTarget = options.requestedTarget ?? options.args[1];
  const suggestions = requestedTarget ? suggestNearbyFiles(options.cwd, requestedTarget) : [];

  const lines = diagnostics(output);

  return {
    ...error.result,
    stdout: options.format === "json" ? buildStatusJson("not_found", requestedTarget, suggestions, lines) : buildNotFoundText(requestedTarget, suggestions),
    stderr: "",
    status: "not_found",
    requestedTarget,
    suggestions,
    diagnostics: lines,
  };
}
