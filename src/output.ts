import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  type TruncationResult,
} from "@earendil-works/pi-coding-agent";
import type { CymbalResultStatus, OutputFormat, RunCymbalResult } from "./cymbal.js";
import { writeManagedSpill } from "./spill.js";

export interface FormatCymbalOutputOptions {
  result: RunCymbalResult;
  format: OutputFormat;
  maxBytes?: number;
  maxLines?: number;
}

export interface CymbalOutputDetails {
  command: string;
  args: string[];
  cwd: string;
  exitCode: number;
  outputFormat: OutputFormat;
  status: CymbalResultStatus;
  parsedJson?: boolean;
  truncated: boolean;
  truncation?: TruncationResult;
  fullOutputPath?: string;
  sourceOutputPath?: string;
  stderrSpillPath?: string;
  diagnostics?: string[];
  suggestions?: string[];
  requestedTarget?: string;
  resolvedCwd?: string;
  resolvedTarget?: string;
  error?: { code: string; message: string };
  results?: CymbalOutputDetails[];
  commands?: BatchCommand[];
}

export interface CymbalToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: CymbalOutputDetails;
}

export interface CymbalBatchItem {
  target: string;
  result: RunCymbalResult;
}

export interface BatchCommand {
  index: number;
  target: string;
  command: string;
  args: string[];
  cwd: string;
  exitCode: number;
}

export interface FormatCymbalBatchOptions {
  items: CymbalBatchItem[];
  format: OutputFormat;
  maxBytes?: number;
  maxLines?: number;
}

const MINIMUM_JSON_ENVELOPE = '{"status":"error"}';
const MINIMUM_JSON_BYTES = Buffer.byteLength(MINIMUM_JSON_ENVELOPE);

function lineCount(value: string): number {
  return value === "" ? 0 : value.split("\n").length;
}

function fits(value: string, maxBytes: number, maxLines: number): boolean {
  return Buffer.byteLength(value) <= maxBytes && lineCount(value) <= maxLines;
}

function validateBudget(maxBytes: number, maxLines: number): void {
  const validBytes = Number.isInteger(maxBytes) && maxBytes >= MINIMUM_JSON_BYTES;
  const validLines = Number.isInteger(maxLines) && maxLines >= 1;
  if (validBytes && validLines) return;
  throw new RangeError(`JSON output requires maxLines >= 1 and maxBytes >= ${MINIMUM_JSON_BYTES}`);
}

function baseDetails(result: RunCymbalResult, format: OutputFormat): CymbalOutputDetails {
  const details: CymbalOutputDetails = {
    command: result.command,
    args: [...result.args],
    cwd: result.cwd,
    exitCode: result.code,
    outputFormat: format,
    status: result.status ?? (result.code === 0 ? "ok" : "error"),
    truncated: false,
  };
  if (result.stdoutPath) details.fullOutputPath = result.stdoutPath;
  if (result.stderrPath) details.stderrSpillPath = result.stderrPath;
  if (result.diagnostics?.length) details.diagnostics = [...result.diagnostics];
  if (result.suggestions?.length) details.suggestions = [...result.suggestions];
  if (result.requestedTarget) details.requestedTarget = result.requestedTarget;
  if (result.resolvedCwd) details.resolvedCwd = result.resolvedCwd;
  if (result.resolvedTarget) details.resolvedTarget = result.resolvedTarget;
  return details;
}

function truncatePreview(envelope: Record<string, unknown>, maxBytes: number, maxLines: number): string | undefined {
  if (typeof envelope.preview !== "string") return undefined;
  const points = Array.from(envelope.preview);
  let low = 0;
  let high = points.length;
  let best: string | undefined;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const serialized = JSON.stringify({ ...envelope, preview: points.slice(0, middle).join("") });
    if (fits(serialized, maxBytes, maxLines)) {
      best = serialized;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

async function serializeEnvelope(
  envelope: Record<string, unknown>,
  details: CymbalOutputDetails,
  maxBytes: number,
  maxLines: number,
  completeContent?: string,
): Promise<string> {
  validateBudget(maxBytes, maxLines);
  let serialized = JSON.stringify(envelope);
  if (fits(serialized, maxBytes, maxLines)) return serialized;

  if (!details.fullOutputPath && completeContent !== undefined) {
    details.fullOutputPath = await writeManagedSpill(completeContent, "output.json");
  }
  if (details.fullOutputPath) envelope = { ...envelope, fullOutputPath: details.fullOutputPath };
  serialized = JSON.stringify(envelope);
  if (fits(serialized, maxBytes, maxLines)) return serialized;

  const previewLimited = truncatePreview(envelope, maxBytes, maxLines);
  if (previewLimited !== undefined) {
    details.truncated = true;
    return previewLimited;
  }

  const sourceOutputPath = details.fullOutputPath;
  details.fullOutputPath = await writeManagedSpill(serialized, "envelope.json");
  if (sourceOutputPath) details.sourceOutputPath = sourceOutputPath;
  details.status = "error";
  details.parsedJson = false;
  details.truncated = true;
  details.error = {
    code: "cymbal_json_envelope_limited",
    message: "Cymbal JSON metadata exceeded the output budget.",
  };
  details.diagnostics = [...(details.diagnostics ?? []), "Complete JSON envelope saved to the managed spill path."];
  return MINIMUM_JSON_ENVELOPE;
}

async function formatJson(options: FormatCymbalOutputOptions, details: CymbalOutputDetails, maxBytes: number, maxLines: number): Promise<string> {
  validateBudget(maxBytes, maxLines);

  if (options.result.stdoutTruncated) {
    const error = {
      code: "cymbal_json_truncated",
      message: "Cymbal JSON exceeded the process capture limit.",
    };
    details.status = "partial";
    details.parsedJson = false;
    details.truncated = true;
    details.error = error;
    const envelope: Record<string, unknown> = {
      results: {},
      status: "partial",
      error,
      preview: options.result.stdout,
    };
    if (details.fullOutputPath) envelope.fullOutputPath = details.fullOutputPath;
    return await serializeEnvelope(envelope, details, maxBytes, maxLines, options.result.stdout);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(options.result.stdout);
  } catch {
    const error = {
      code: "malformed_cymbal_json",
      message: "Cymbal returned malformed JSON.",
    };
    details.status = "error";
    details.parsedJson = false;
    details.error = error;
    return await serializeEnvelope(
      { results: {}, status: "error", error, preview: options.result.stdout },
      details,
      maxBytes,
      maxLines,
      options.result.stdout,
    );
  }

  details.parsedJson = true;
  const pretty = JSON.stringify(parsed, null, 2);
  if (fits(pretty, maxBytes, maxLines)) return pretty;

  details.fullOutputPath = await writeManagedSpill(pretty, "output.json");
  details.status = "partial";
  details.truncated = true;
  const error = {
    code: "cymbal_json_output_limited",
    message: "Cymbal JSON exceeded the final output limit.",
  };
  details.error = error;
  return await serializeEnvelope(
    { results: {}, status: "partial", error, preview: truncateHead(pretty, { maxBytes, maxLines }).content, fullOutputPath: details.fullOutputPath },
    details,
    maxBytes,
    maxLines,
    pretty,
  );
}

async function formatAgent(options: FormatCymbalOutputOptions, details: CymbalOutputDetails, maxBytes: number, maxLines: number): Promise<string> {
  const visible = options.result.stdout;
  const truncation = truncateHead(visible, { maxBytes, maxLines });
  if (!truncation.truncated && !options.result.stdoutTruncated) return visible;

  details.fullOutputPath ??= await writeManagedSpill(visible, "output.txt");
  details.truncated = true;
  details.truncation = truncation;
  if (options.result.stdoutTruncated && details.status === "ok") details.status = "partial";

  const truncatedLines = Math.max(0, truncation.totalLines - truncation.outputLines);
  const truncatedBytes = Math.max(0, truncation.totalBytes - truncation.outputBytes);
  const marker = `[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}). ${truncatedLines} lines (${formatSize(truncatedBytes)}) omitted. Full output saved to: ${details.fullOutputPath}]`;
  const headBudget = Math.max(0, maxBytes - Buffer.byteLength(marker) - 2);
  const headLines = Math.max(1, maxLines - 2);
  const head = truncateHead(visible, { maxBytes: headBudget, maxLines: headLines }).content;
  const combined = head ? `${head}\n\n${marker}` : marker;
  return fits(combined, maxBytes, maxLines) ? combined : truncateHead(marker, { maxBytes, maxLines }).content;
}

export async function formatCymbalOutput(options: FormatCymbalOutputOptions): Promise<CymbalToolResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const details = baseDetails(options.result, options.format);
  const visible = options.format === "json"
    ? await formatJson(options, details, maxBytes, maxLines)
    : await formatAgent(options, details, maxBytes, maxLines);
  return { content: [{ type: "text", text: visible }], details };
}

function aggregateStatus(statuses: CymbalResultStatus[]): CymbalResultStatus {
  if (!statuses.length) return "error";
  for (const status of ["ok", "not_found", "empty", "unsupported", "error"] as const) {
    if (statuses.every((candidate) => candidate === status)) return status;
  }
  return "partial";
}

function batchCommand(item: CymbalBatchItem, index: number): BatchCommand {
  return {
    index,
    target: item.target,
    command: item.result.command,
    args: [...item.result.args],
    cwd: item.result.cwd,
    exitCode: item.result.code,
  };
}

function batchCommandText(commands: BatchCommand[]): string {
  return commands.map((command) => command.command).join("; ");
}

export async function formatCymbalBatch(options: FormatCymbalBatchOptions): Promise<CymbalToolResult> {
  if (options.items.length < 1 || options.items.length > 32) throw new RangeError("batch must contain between 1 and 32 targets");
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;

  if (options.format === "agent") {
    const itemDetails = options.items.map(({ result }) => {
      const details = baseDetails(result, "agent");
      if (result.stdoutTruncated) {
        details.truncated = true;
        if (details.status === "ok") details.status = "partial";
      }
      return details;
    });
    const stdout = options.items
      .map(({ target, result }) => {
        const captureNotice = result.stdoutTruncated && result.stdoutPath
          ? `\n\n[Process output truncated. Full output saved to: ${result.stdoutPath}]`
          : "";
        return `## ${target}\n\n${result.stdout}${captureNotice}`;
      })
      .join("\n\n---\n\n");
    const commands = options.items.map(batchCommand);
    const synthetic: RunCymbalResult = {
      command: batchCommandText(commands),
      args: [],
      cwd: options.items[0].result.cwd,
      stdout,
      stderr: "",
      code: itemDetails.some((details) => details.exitCode !== 0) ? 1 : 0,
      status: aggregateStatus(itemDetails.map((details) => details.status)),
    };
    const aggregate = await formatCymbalOutput({ result: synthetic, format: "agent", maxBytes, maxLines });
    aggregate.details.results = itemDetails;
    aggregate.details.commands = commands;
    return aggregate;
  }

  const commands: BatchCommand[] = [];
  const entries = [];
  const statuses: CymbalResultStatus[] = [];
  for (const [index, item] of options.items.entries()) {
    const { target, result } = item;
    const details = baseDetails(result, "json");
    let status = details.status;
    let payload: unknown;
    let error: { code: string; message: string } | undefined;
    if (result.stdoutTruncated) {
      status = "partial";
      error = { code: "cymbal_json_truncated", message: "Cymbal JSON exceeded the process capture limit." };
      details.parsedJson = false;
      details.truncated = true;
      details.error = error;
    } else {
      try {
        payload = JSON.parse(result.stdout);
        details.parsedJson = true;
      } catch {
        status = "error";
        error = { code: "malformed_cymbal_json", message: "Cymbal returned malformed JSON." };
        details.parsedJson = false;
        details.error = error;
      }
    }
    details.status = status;
    statuses.push(status);
    commands.push(batchCommand(item, index));
    entries.push({
      index,
      target,
      status,
      ...(payload !== undefined ? { payload } : {}),
      ...(error ? { error, preview: result.stdout } : {}),
      details,
    });
  }

  const status = aggregateStatus(statuses);
  const payload = { status, results: entries, commands };
  const synthetic: RunCymbalResult = {
    command: batchCommandText(commands),
    args: [],
    cwd: options.items[0].result.cwd,
    stdout: JSON.stringify(payload),
    stderr: "",
    code: status === "error" ? 1 : 0,
    status,
  };
  const formatted = await formatCymbalOutput({ result: synthetic, format: "json", maxBytes, maxLines });
  formatted.details.results = entries.map((entry) => entry.details);
  formatted.details.commands = commands;
  return formatted;
}
