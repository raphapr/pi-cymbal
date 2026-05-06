import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
}

export interface HookContext {
  cwd: string;
  hasUI?: boolean;
  ui?: { notify?: (message: string, type?: "info" | "warning" | "error") => void };
}

export interface ToolCallEventLike {
  toolName: string;
  input: unknown;
}

export function buildNudgePayload(command: string): string {
  return JSON.stringify({ tool_name: "bash", tool_input: { command } });
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
  const parts = [`Cymbal suggests: ${suggestion.suggest}`];
  if (suggestion.why) parts.push(`Why: ${suggestion.why}`);
  if (suggestion.tool) parts.push(`Tool: ${suggestion.tool}`);
  return parts.join("\n");
}

export function createCymbalHooks(deps: HookDeps = {}) {
  const run = deps.run ?? runCymbal;
  let reminderText = "";

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

    async handleToolCall(event: ToolCallEventLike, ctx: HookContext): Promise<void> {
      if (event.toolName !== "bash") return;
      const input = event.input as { command?: unknown };
      if (typeof input.command !== "string" || !input.command.trim()) return;

      try {
        const result = await run({
          cwd: ctx.cwd,
          args: ["hook", "nudge", "--format=json"],
          input: buildNudgePayload(input.command),
          timeoutMs: 5_000,
        });
        const suggestion = parseNudgeResponse(result.stdout);
        if (!suggestion) return;

        const content = buildNudgeMessage(suggestion);
        await deps.sendMessage?.({ customType: "pi-cymbal-nudge", content, display: true });
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
