import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
  withFileMutationQueue,
  type TruncationResult,
} from "@mariozechner/pi-coding-agent";
import type { OutputFormat, RunCymbalResult } from "./cymbal.js";

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
  parsedJson?: boolean;
  truncated: boolean;
  truncation?: TruncationResult;
  fullOutputPath?: string;
}

export interface CymbalToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: CymbalOutputDetails;
}

export async function formatCymbalOutput(options: FormatCymbalOutputOptions): Promise<CymbalToolResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const details: CymbalOutputDetails = {
    command: options.result.command,
    args: [...options.result.args],
    cwd: options.result.cwd,
    exitCode: options.result.code,
    outputFormat: options.format,
    truncated: false,
  };

  let visible = options.result.stdout;
  if (options.format === "json") {
    try {
      visible = JSON.stringify(JSON.parse(options.result.stdout), null, 2);
      details.parsedJson = true;
    } catch {
      details.parsedJson = false;
    }
  }

  const truncation = truncateHead(visible, { maxBytes, maxLines });
  visible = truncation.content;

  if (truncation.truncated) {
    const tempDir = await mkdtemp(join(tmpdir(), "pi-cymbal-"));
    const fullOutputPath = join(tempDir, "output.txt");
    await withFileMutationQueue(fullOutputPath, async () => {
      await writeFile(fullOutputPath, options.result.stdout, "utf8");
    });

    details.truncated = true;
    details.truncation = truncation;
    details.fullOutputPath = fullOutputPath;

    const truncatedLines = truncation.totalLines - truncation.outputLines;
    const truncatedBytes = truncation.totalBytes - truncation.outputBytes;
    visible += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
    visible += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
    visible += ` ${truncatedLines} lines (${formatSize(truncatedBytes)}) omitted.`;
    visible += ` Full output saved to: ${fullOutputPath}]`;
  }

  return {
    content: [{ type: "text", text: visible }],
    details,
  };
}
