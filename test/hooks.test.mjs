import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNudgePayload,
  createCymbalHooks,
  parseNudgeResponse,
} from "../src/hooks.ts";

test("buildNudgePayload wraps bash command", () => {
  assert.equal(buildNudgePayload("bash", { command: "rg -n auth ." }), JSON.stringify({ tool_name: "bash", tool_input: { command: "rg -n auth ." } }));
});

test("buildNudgePayload maps grep input with Cymbal casing and fields", () => {
  assert.equal(
    buildNudgePayload("grep", { pattern: "auth", glob: "src/**/*.ts", type: "js" }),
    JSON.stringify({ tool_name: "Grep", tool_input: { pattern: "auth", glob: "src/**/*.ts" } }),
  );
});

test("buildNudgePayload does not nudge read calls", () => {
  assert.equal(buildNudgePayload("read", { path: "src/hooks.ts" }), undefined);
  assert.equal(buildNudgePayload("Read", { file_path: "src/hooks.ts" }), undefined);
});

test("buildNudgePayload returns undefined for unsupported tools", () => {
  assert.equal(buildNudgePayload("write", { path: "src/hooks.ts" }), undefined);
});

test("buildNudgePayload returns undefined for malformed input", () => {
  assert.equal(buildNudgePayload("bash", null), undefined);
  assert.equal(buildNudgePayload("bash", { command: "" }), undefined);
  assert.equal(buildNudgePayload("grep", "auth"), undefined);
  assert.equal(buildNudgePayload("grep", { pattern: 123 }), undefined);
  assert.equal(buildNudgePayload("read", { path: "" }), undefined);
});

test("buildNudgePayload uses exact Grep payload casing", () => {
  assert.equal(JSON.parse(buildNudgePayload("grep", { pattern: "auth" })).tool_name, "Grep");
});

test("parseNudgeResponse extracts suggestion", () => {
  const result = parseNudgeResponse('{"suggest":"Use cymbal search auth","why":"symbol search","tool":"cymbal"}');
  assert.deepEqual(result, { suggest: "Use cymbal search auth", why: "symbol search", tool: "cymbal" });
});

test("parseNudgeResponse ignores empty output", () => {
  assert.equal(parseNudgeResponse(""), undefined);
});

test("reminder injects cached guidance", async () => {
  const hooks = createCymbalHooks({
    run: async () => ({ command: "cymbal hook remind", args: ["hook", "remind"], cwd: ".", stdout: "Use Cymbal", stderr: "", code: 0 }),
  });
  await hooks.refreshReminder({ cwd: "." });
  const result = hooks.injectReminder({ systemPrompt: "Base" });
  assert.match(result.systemPrompt, /Base/);
  assert.match(result.systemPrompt, /Cymbal navigation guidance/);
  assert.match(result.systemPrompt, /Use Cymbal/);
});

test("reminder failures are swallowed", async () => {
  const hooks = createCymbalHooks({
    run: async () => { throw new Error("missing"); },
  });
  const refreshed = await hooks.refreshReminder({ cwd: "." });
  assert.equal(refreshed, false);
  assert.deepEqual(hooks.injectReminder({ systemPrompt: "Base" }), { systemPrompt: "Base" });
});

test("nudge sends hidden advisory steering message without blocking", async () => {
  const messages = [];
  const hooks = createCymbalHooks({
    run: async (_options) => ({ command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout: '{"suggest":"Use cymbal_search","why":"better index","tool":"cymbal_search"}', stderr: "", code: 0 }),
    sendMessage: (message) => messages.push(message),
  });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].display, false);
  assert.match(messages[0].content, /Use cymbal_search/);
  assert.match(messages[0].content, /Use this if it fits; ignore it if your original tool is intentional\./);
});

test("nudge shows UI notification when UI is available", async () => {
  const notifications = [];
  const hooks = createCymbalHooks({
    run: async (_options) => ({ command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout: '{"suggest":"Use cymbal_search auth","why":"symbol search","tool":"cymbal_search"}', stderr: "", code: 0 }),
  });
  await hooks.handleToolCall(
    { toolName: "grep", input: { pattern: "auth" } },
    { cwd: ".", hasUI: true, ui: { notify: (message, type) => notifications.push({ message, type }) } },
  );
  assert.deepEqual(notifications, [
    {
      message: "Cymbal suggests: Use cymbal_search auth\nUse this if it fits; ignore it if your original tool is intentional.\nWhy: symbol search\nTool: cymbal_search",
      type: "info",
    },
  ]);
});

test("nudge sends grep payload with Cymbal casing and fields", async () => {
  const payloads = [];
  const hooks = createCymbalHooks({
    run: async (options) => {
      payloads.push(options.input);
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: "", stderr: "", code: 0 };
    },
  });
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth", glob: "src/**/*.ts", type: "ts" } }, { cwd: "." });
  assert.deepEqual(JSON.parse(payloads[0]), { tool_name: "Grep", tool_input: { pattern: "auth", glob: "src/**/*.ts" } });
});

test("nudge skips read calls", async () => {
  let called = false;
  const hooks = createCymbalHooks({
    run: async () => { called = true; throw new Error("should not run"); },
  });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/hooks.ts" } }, { cwd: "." });
  assert.equal(called, false);
});

test("nudge ignores unsupported tools and malformed input", async () => {
  let called = false;
  const hooks = createCymbalHooks({
    run: async () => { called = true; throw new Error("should not run"); },
  });
  await hooks.handleToolCall({ toolName: "write", input: { path: "file" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "grep", input: null }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "read", input: { path: 123 } }, { cwd: "." });
  assert.equal(called, false);
});

test("nudge failures are swallowed", async () => {
  const hooks = createCymbalHooks({
    run: async () => { throw new Error("nudge failed"); },
    sendMessage: () => { throw new Error("should not send"); },
  });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });
});

test("nudge suppresses duplicate suggestions per cwd for 60 seconds", async () => {
  let currentTime = 1_000;
  const messages = [];
  const hooks = createCymbalHooks({
    now: () => currentTime,
    run: async (_options) => ({ command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout: '{"suggest":"Use cymbal_search","why":"better index","tool":"cymbal_search"}', stderr: "", code: 0 }),
    sendMessage: (message) => messages.push(message),
  });

  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "/repo-a" });
  currentTime += 59_000;
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth" } }, { cwd: "/repo-a" });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/hooks.ts" } }, { cwd: "/repo-b" });
  currentTime += 1_001;
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth" } }, { cwd: "/repo-a" });

  assert.equal(messages.length, 2);
});

test("hooks only invoke remind or nudge commands and never index", async () => {
  const calls = [];
  const hooks = createCymbalHooks({
    run: async (options) => {
      calls.push(options.args);
      if (options.args[1] === "remind") {
        return { command: "cymbal hook remind", args: options.args, cwd: options.cwd, stdout: "Use Cymbal", stderr: "", code: 0 };
      }
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: "", stderr: "", code: 0 };
    },
  });

  await hooks.refreshReminder({ cwd: "." });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });

  assert.deepEqual(calls, [
    ["hook", "remind", "--format=text", "--update=if-stale"],
    ["hook", "nudge", "--format=json"],
  ]);
  assert.equal(calls.some((args) => args.includes("index")), false);
});
