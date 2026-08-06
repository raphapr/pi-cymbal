import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DEFAULT_CYMBAL_CONFIG, type CymbalConfig } from "./config.js";
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
  hasActiveCymbalTools?: () => boolean;
}

export interface HookContext {
  cwd: string;
  signal?: AbortSignal;
  hasUI?: boolean;
  isProjectTrusted?: () => boolean;
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

const STALE_NUDGE_SUGGESTIONS = new Map<string, string>([["cymbal ls --names", "cymbal ls"]]);

function normalizeNudgeSuggestion(suggest: string): string | undefined {
  const trimmed = suggest.trim();
  if (!trimmed) return undefined;
  return STALE_NUDGE_SUGGESTIONS.get(trimmed) ?? trimmed;
}

export function parseNudgeResponse(output: string): NudgeSuggestion | undefined {
  const trimmed = output.trim();
  if (!trimmed) return undefined;
  try {
    const value = JSON.parse(trimmed) as Partial<NudgeSuggestion>;
    if (typeof value.suggest !== "string") return undefined;
    const suggest = normalizeNudgeSuggestion(value.suggest);
    if (!suggest) return undefined;
    return {
      suggest,
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
  const hasActiveCymbalTools = deps.hasActiveCymbalTools ?? (() => true);
  const seenSuggestions = new Map<string, number>();
  const inFlight = new Map<string, Promise<void>>();
  const tracked = new Set<Promise<unknown>>();
  let sessionController = new AbortController();
  let acceptingWork = true;
  let config: CymbalConfig = { ...DEFAULT_CYMBAL_CONFIG };
  let reminderText = "";

  function track<T>(promise: Promise<T>): Promise<T> {
    tracked.add(promise);
    void promise.finally(() => tracked.delete(promise)).catch(() => undefined);
    return promise;
  }

  async function settleTracked(): Promise<void> {
    while (tracked.size) await Promise.allSettled([...tracked]);
  }

  function combinedSignal(signal?: AbortSignal): AbortSignal {
    return signal ? AbortSignal.any([signal, sessionController.signal]) : sessionController.signal;
  }

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

  async function runNudge(event: ToolCallEventLike, ctx: HookContext, payload: string): Promise<void> {
    try {
      const result = await run({
        cwd: ctx.cwd,
        args: ["hook", "nudge", "--format=json"],
        input: payload,
        timeoutMs: 5_000,
        signal: combinedSignal(ctx.signal),
      });
      const suggestion = parseNudgeResponse(result.stdout);
      if (!config.nudges || !hasActiveCymbalTools() || !suggestion || shouldSuppressSuggestion(ctx.cwd, suggestion.suggest, event.toolName)) return;

      const content = buildNudgeMessage(suggestion);
      await deps.sendMessage?.({ customType: "pi-cymbal-nudge", content, display: false });
      if (ctx.hasUI && ctx.ui?.notify) ctx.ui.notify(content, "info");
    } catch {
      return;
    }
  }

  const hooks = {
    async startSession(nextConfig: CymbalConfig = { ...DEFAULT_CYMBAL_CONFIG }): Promise<void> {
      acceptingWork = false;
      config = nextConfig;
      if (!sessionController.signal.aborted) sessionController.abort(new DOMException("Cymbal session replaced", "AbortError"));
      await settleTracked();
      inFlight.clear();
      seenSuggestions.clear();
      reminderText = "";
      sessionController = new AbortController();
      acceptingWork = true;
    },

    async shutdown(): Promise<void> {
      acceptingWork = false;
      if (!sessionController.signal.aborted) sessionController.abort(new DOMException("Cymbal session shut down", "AbortError"));
      await settleTracked();
      inFlight.clear();
      seenSuggestions.clear();
      reminderText = "";
    },

    async refreshReminder(ctx: HookContext): Promise<boolean> {
      if (!acceptingWork || !config.systemPrompt || !hasActiveCymbalTools()) {
        reminderText = "";
        return false;
      }
      const operation = (async () => {
        try {
          const result = await run({
            cwd: ctx.cwd,
            args: ["hook", "remind", "--format=text", "--update=if-stale"],
            timeoutMs: 5_000,
            signal: combinedSignal(ctx.signal),
          });
          reminderText = result.stdout.trim();
          return true;
        } catch {
          reminderText = "";
          return false;
        }
      })();
      return await track(operation);
    },

    injectReminder(event: { systemPrompt: string }): { systemPrompt: string } {
      if (!config.systemPrompt || !hasActiveCymbalTools() || !reminderText) return { systemPrompt: event.systemPrompt };
      return {
        systemPrompt: `${event.systemPrompt}\n\n# Cymbal navigation guidance\n\n${reminderText}`,
      };
    },

    getConfig(): CymbalConfig {
      return { ...config };
    },

    updateConfig(nextConfig: Partial<CymbalConfig>): void {
      config = { ...config, ...nextConfig };
      if (!config.systemPrompt) reminderText = "";
    },

    collapseCymbalTool(event: ToolExecutionStartEventLike, ctx: HookContext): void {
      if (!isCymbalToolName(event.toolName)) return;
      ctx.ui?.setToolsExpanded?.(false);
    },

    handleToolCall(event: ToolCallEventLike, ctx: HookContext): Promise<void> {
      const payload = buildNudgePayload(event.toolName, event.input);
      if (!payload || !acceptingWork || !config.nudges || !hasActiveCymbalTools()) return Promise.resolve();

      const key = `${ctx.cwd}\u0000${payload}`;
      const existing = inFlight.get(key);
      if (existing) return existing;

      const task = track(runNudge(event, ctx, payload));
      inFlight.set(key, task);
      void task.finally(() => {
        if (inFlight.get(key) === task) inFlight.delete(key);
      }).catch(() => undefined);
      return task;
    },

    startToolCall(event: ToolCallEventLike, ctx: HookContext): void {
      void hooks.handleToolCall(event, ctx);
    },
  };

  return hooks;
}

export function registerCymbalHooks(pi: ExtensionAPI): ReturnType<typeof createCymbalHooks> {
  const hooks = createCymbalHooks({
    sendMessage: async (message) => {
      await pi.sendMessage(message);
    },
    hasActiveCymbalTools: () => pi.getActiveTools().some(isCymbalToolName),
  });

  pi.on("before_agent_start", (event: { systemPrompt: string }) => hooks.injectReminder(event));

  pi.on("tool_call", (event: ToolCallEventLike, ctx: HookContext) => {
    hooks.startToolCall(event, ctx);
  });

  pi.on("tool_execution_start", (event: ToolExecutionStartEventLike, ctx: HookContext) => {
    hooks.collapseCymbalTool(event, ctx);
  });

  pi.registerCommand("cymbal", {
    description: "Show or change Cymbal settings for this session",
    handler: async (args: string, ctx: HookContext) => {
      const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (parts.length === 0 || (parts.length === 1 && parts[0] === "status")) {
        const current = hooks.getConfig();
        ctx.ui?.notify?.(`Cymbal system prompt: ${current.systemPrompt ? "on" : "off"}; nudges: ${current.nudges ? "on" : "off"}`, "info");
        return;
      }

      const enabled = parts.at(-1) === "on" ? true : parts.at(-1) === "off" ? false : undefined;
      const target = parts.length === 1 ? "all" : parts[0];
      if (enabled === undefined || !["all", "system-prompt", "nudges"].includes(target) || parts.length > 2) {
        ctx.ui?.notify?.("Usage: /cymbal [status|on|off|system-prompt on|off|nudges on|off]", "warning");
        return;
      }

      const next = target === "all"
        ? { systemPrompt: enabled, nudges: enabled }
        : target === "system-prompt"
          ? { systemPrompt: enabled }
          : { nudges: enabled };
      hooks.updateConfig(next);
      if (enabled && target !== "nudges") await hooks.refreshReminder(ctx);
      ctx.ui?.notify?.(`${target === "all" ? "Cymbal" : `Cymbal ${target}`} ${enabled ? "enabled" : "disabled"} for this session`, "info");
    },
  });

  return hooks;
}
