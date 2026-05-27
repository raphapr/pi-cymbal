import { keyHint } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { CymbalToolResult } from "./output.js";

interface RenderTheme {
  fg(slot: string, text: string): string;
  bold(text: string): string;
}

interface RenderContext {
  lastComponent?: unknown;
  expanded: boolean;
  isError?: boolean;
}

interface RenderResultOptions {
  expanded: boolean;
  isPartial: boolean;
}

const MAX_COLLAPSED_ARGS = 4;
const MAX_VALUE_LENGTH = 80;

function textComponent(lastComponent: unknown): Text {
  return lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatArgValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return truncate(JSON.stringify(value), MAX_VALUE_LENGTH);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return truncate(`[${value.map((item) => formatArgValue(item) ?? JSON.stringify(item)).join(", ")}]`, MAX_VALUE_LENGTH);
  }
  return truncate(JSON.stringify(value), MAX_VALUE_LENGTH);
}

function formatCollapsedArgs(args: unknown): string {
  if (typeof args !== "object" || args === null) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    const formatted = formatArgValue(value);
    if (formatted === undefined) continue;
    parts.push(`${key}=${formatted}`);
    if (parts.length === MAX_COLLAPSED_ARGS) break;
  }

  const omitted = Object.entries(args).filter(([, value]) => formatArgValue(value) !== undefined).length - parts.length;
  if (omitted > 0) parts.push("…");
  return parts.join(" ");
}

function countOutputLines(output: string): number {
  if (!output) return 0;
  return output.endsWith("\n") ? output.slice(0, -1).split("\n").length : output.split("\n").length;
}

function getTextOutput(result: CymbalToolResult): string {
  return result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function statusLabel(status: string | undefined, isError: boolean | undefined): string {
  if (isError) return "error";
  if (!status) return "ok";
  return status.replace(/_/g, " ");
}

function statusIcon(status: string | undefined, isError: boolean | undefined): string {
  if (isError || status === "error") return "✗";
  if (status === "not_found" || status === "no_repo") return "!";
  return "✓";
}

function resultColor(status: string | undefined, isError: boolean | undefined): string {
  if (isError || status === "error") return "error";
  if (status === "not_found" || status === "no_repo") return "warning";
  return "success";
}

function outputSummary(result: CymbalToolResult, output: string): string {
  const details = result.details;
  if (details.truncated && details.truncation) {
    const shownLines = details.truncation.outputLines;
    const shownLabel = shownLines === 1 ? "line" : "lines";
    return `${shownLines} ${shownLabel} shown of ${details.truncation.totalLines}`;
  }

  const lineCount = countOutputLines(output);
  const lineLabel = lineCount === 1 ? "line" : "lines";
  return lineCount === 0 ? "no output" : `${lineCount} ${lineLabel}`;
}

function expandHint(): string {
  try {
    return keyHint("app.tools.expand", "to expand");
  } catch {
    return "expand for details";
  }
}

export function renderCymbalCall(toolName: string, args: unknown, theme: RenderTheme, context: RenderContext): Text {
  const text = textComponent(context.lastComponent);
  const title = theme.fg("toolTitle", theme.bold(toolName));

  if (context.expanded) {
    const renderedArgs = JSON.stringify(args, null, 2);
    text.setText(renderedArgs && renderedArgs !== "{}" ? `${title}\n${renderedArgs}` : title);
    return text;
  }

  const renderedArgs = formatCollapsedArgs(args);
  text.setText(renderedArgs ? `${title} ${theme.fg("muted", renderedArgs)}` : title);
  return text;
}

export function renderCymbalResult(
  result: CymbalToolResult,
  options: RenderResultOptions,
  theme: RenderTheme,
  context: RenderContext,
): Text {
  const text = textComponent(context.lastComponent);
  const output = getTextOutput(result);

  if (options.isPartial) {
    text.setText(theme.fg("muted", "Running Cymbal…"));
    return text;
  }

  if (options.expanded) {
    text.setText(output || theme.fg("muted", "No output"));
    return text;
  }

  const status = result.details.status;
  const summary = [
    `${statusIcon(status, context.isError)} ${statusLabel(status, context.isError)}`,
    outputSummary(result, output),
  ].join(" · ");

  text.setText(`${theme.fg(resultColor(status, context.isError), summary)} · ${expandHint()}`);
  return text;
}
