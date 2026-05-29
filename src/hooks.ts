import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runCymbal, type RunCymbalOptions, type RunCymbalResult } from "./cymbal.js";

export interface NudgeSuggestion {
  suggest: string;
  why?: string;
  tool?: string;
}

export interface HookRunnerOptions extends RunCymbalOptions {}
export type HookRunner = (options: HookRunnerOptions) => Promise<RunCymbalResult>;
export type SendMessage = (message: { customType: string; content: string; display: boolean }) => void | Promise<void>;

export interface HookDeps {
  run?: HookRunner;
  sendMessage?: SendMessage;
  now?: () => number;
}

export interface HookContext {
  cwd: string;
  hasUI?: boolean;
  ui?: {
    notify?: (message: string, type?: "info" | "warning" | "error") => void;
    setToolsExpanded?: (expanded: boolean) => void;
  };
}

export interface ToolExecutionStartEventLike {
  toolName: string;
}

export interface ToolCallEventLike {
  toolName: string;
  input: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildNudgePayload(toolName: string, input: unknown): string | undefined {
  if (!isRecord(input)) return undefined;

  if (toolName === "bash") {
    const { command } = input;
    if (typeof command !== "string" || !command.trim()) return undefined;
    return JSON.stringify({ tool_name: "bash", tool_input: { command } });
  }

  if (toolName === "grep") {
    const { pattern, glob, literal } = input;
    if (literal === true) return undefined;
    if (typeof pattern !== "string" || !pattern.trim()) return undefined;
    const toolInput: { pattern: string; glob?: string } = { pattern };
    if (typeof glob === "string" && glob.trim()) toolInput.glob = glob;
    return JSON.stringify({ tool_name: "Grep", tool_input: toolInput });
  }

  if (toolName === "find") {
    const { pattern } = input;
    if (typeof pattern !== "string" || !pattern.trim()) return undefined;
    return JSON.stringify({ tool_name: "Glob", tool_input: { pattern } });
  }

  if (toolName === "read") {
    const { path } = input;
    if (typeof path !== "string" || !path.trim()) return undefined;
    return JSON.stringify({ tool_name: "Read", tool_input: { file_path: path } });
  }

  return undefined;
}

export function parseNudgeResponse(output: string): NudgeSuggestion | undefined {
  const trimmed = output.trim();
  if (!trimmed) return undefined;
  try {
    const value = JSON.parse(trimmed) as Partial<NudgeSuggestion>;
    if (typeof value.suggest !== "string" || !value.suggest.trim()) return undefined;
    return {
      suggest: value.suggest,
      why: typeof value.why === "string" ? value.why : undefined,
      tool: typeof value.tool === "string" ? value.tool : undefined,
    };
  } catch {
    return undefined;
  }
}

function buildNudgeMessage(suggestion: NudgeSuggestion): string {
  const parts = [
    `Cymbal suggests: ${suggestion.suggest}`,
    "Use this if it fits; ignore it if your original tool is intentional.",
  ];
  if (suggestion.why) parts.push(`Why: ${suggestion.why}`);
  if (suggestion.tool) parts.push(`Tool: ${suggestion.tool}`);
  return parts.join("\n");
}

const NUDGE_SUPPRESSION_MS = 60_000;
const CYMBAL_TOOL_PREFIX = "cymbal_";

export function isCymbalToolName(toolName: string): boolean {
  return toolName.startsWith(CYMBAL_TOOL_PREFIX);
}

export function createCymbalHooks(deps: HookDeps = {}) {
  const run = deps.run ?? runCymbal;
  const now = deps.now ?? Date.now;
  const seenSuggestions = new Map<string, number>();
  let reminderText = "";

  function shouldSuppressSuggestion(cwd: string, suggest: string, toolName: string): boolean {
    const currentTime = now();
    for (const [key, expiresAt] of seenSuggestions) {
      if (expiresAt <= currentTime) seenSuggestions.delete(key);
    }

    const suppressionKey = toolName === "read" ? "tool:Read" : toolName === "find" ? "tool:Glob" : `suggest:${suggest}`;
    const key = `${cwd}\u0000${suppressionKey}`;
    const expiresAt = seenSuggestions.get(key);
    if (expiresAt !== undefined && expiresAt > currentTime) return true;
    seenSuggestions.set(key, currentTime + NUDGE_SUPPRESSION_MS);
    return false;
  }

  return {
    async refreshReminder(ctx: HookContext): Promise<boolean> {
      try {
        const result = await run({
          cwd: ctx.cwd,
          args: ["hook", "remind", "--format=text", "--update=if-stale"],
          timeoutMs: 5_000,
        });
        reminderText = result.stdout.trim();
        return true;
      } catch {
        reminderText = "";
        return false;
      }
    },

    injectReminder(event: { systemPrompt: string }): { systemPrompt: string } {
      if (!reminderText) return { systemPrompt: event.systemPrompt };
      return {
        systemPrompt: `${event.systemPrompt}\n\n# Cymbal navigation guidance\n\n${reminderText}`,
      };
    },

    collapseCymbalTool(event: ToolExecutionStartEventLike, ctx: HookContext): void {
      if (!isCymbalToolName(event.toolName)) return;
      ctx.ui?.setToolsExpanded?.(false);
    },

    async handleToolCall(event: ToolCallEventLike, ctx: HookContext): Promise<void> {
      const payload = buildNudgePayload(event.toolName, event.input);
      if (!payload) return;

      try {
        const result = await run({
          cwd: ctx.cwd,
          args: ["hook", "nudge", "--format=json"],
          input: payload,
          timeoutMs: 5_000,
        });
        const suggestion = parseNudgeResponse(result.stdout);
        if (!suggestion || shouldSuppressSuggestion(ctx.cwd, suggestion.suggest, event.toolName)) return;

        const content = buildNudgeMessage(suggestion);
        await deps.sendMessage?.({ customType: "pi-cymbal-nudge", content, display: false });
        if (ctx.hasUI && ctx.ui?.notify) ctx.ui.notify(content, "info");
      } catch {
        return;
      }
    },
  };
}

export function registerCymbalHooks(pi: ExtensionAPI): void {
  const hooks = createCymbalHooks({
    sendMessage: async (message) => {
      await pi.sendMessage(message);
    },
  });

  pi.on("session_start", async (_event: unknown, ctx: HookContext) => {
    await hooks.refreshReminder(ctx);
  });

  pi.on("before_agent_start", (event: { systemPrompt: string }) => hooks.injectReminder(event));

  pi.on("tool_call", (event: ToolCallEventLike, ctx: HookContext) => {
    void hooks.handleToolCall(event, ctx);
  });

  pi.on("tool_execution_start", (event: ToolExecutionStartEventLike, ctx: HookContext) => {
    hooks.collapseCymbalTool(event, ctx);
  });

  pi.registerCommand("cymbal:remind", {
    description: "Refresh Cymbal navigation reminder guidance",
    handler: async (_args: string, ctx: HookContext) => {
      const refreshed = await hooks.refreshReminder(ctx);
      if (ctx.hasUI && ctx.ui?.notify) {
        ctx.ui.notify(refreshed ? "Cymbal reminder refreshed" : "Cymbal reminder unavailable", refreshed ? "info" : "warning");
      }
    },
  });
}
