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
  assert.equal(
    buildNudgePayload("grep", { pattern: "auth", glob: "   " }),
    JSON.stringify({ tool_name: "Grep", tool_input: { pattern: "auth" } }),
  );
});

test("buildNudgePayload skips literal grep input", () => {
  assert.equal(buildNudgePayload("grep", { pattern: "auth", literal: true }), undefined);
});

test("buildNudgePayload maps find input to Glob", () => {
  assert.equal(buildNudgePayload("find", { pattern: "**/*.ts" }), JSON.stringify({ tool_name: "Glob", tool_input: { pattern: "**/*.ts" } }));
});

test("buildNudgePayload maps read input to Read file_path", () => {
  assert.equal(buildNudgePayload("read", { path: "src/hooks.ts" }), JSON.stringify({ tool_name: "Read", tool_input: { file_path: "src/hooks.ts" } }));
});

test("buildNudgePayload returns undefined for unsupported tools", () => {
  assert.equal(buildNudgePayload("write", { path: "src/hooks.ts" }), undefined);
});

test("buildNudgePayload returns undefined for malformed input", () => {
  const malformedInputs = [
    ["bash", null],
    ["bash", { command: "" }],
    ["bash", { command: "   " }],
    ["bash", { command: 123 }],
    ["grep", "auth"],
    ["grep", { pattern: "" }],
    ["grep", { pattern: "   " }],
    ["grep", { pattern: 123 }],
    ["find", null],
    ["find", { pattern: "" }],
    ["find", { pattern: "   " }],
    ["find", { pattern: 123 }],
    ["read", null],
    ["read", { path: "" }],
    ["read", { path: "   " }],
    ["read", { path: 123 }],
    ["Read", { file_path: "src/hooks.ts" }],
  ];

  for (const [toolName, input] of malformedInputs) {
    assert.equal(buildNudgePayload(toolName, input), undefined);
  }
});

test("buildNudgePayload uses exact dedicated-tool payload casing", () => {
  assert.equal(JSON.parse(buildNudgePayload("grep", { pattern: "auth" })).tool_name, "Grep");
  assert.equal(JSON.parse(buildNudgePayload("find", { pattern: "**/*.ts" })).tool_name, "Glob");
  assert.equal(JSON.parse(buildNudgePayload("read", { path: "src/hooks.ts" })).tool_name, "Read");
});

test("parseNudgeResponse extracts suggestion", () => {
  const result = parseNudgeResponse('{"suggest":"Use cymbal search auth","why":"symbol search","tool":"cymbal"}');
  assert.deepEqual(result, { suggest: "Use cymbal search auth", why: "symbol search", tool: "cymbal" });
});

test("parseNudgeResponse rewrites stale ls names suggestion", () => {
  const result = parseNudgeResponse('{"suggest":"cymbal ls --names","why":"indexed paths","tool":"Glob"}');
  assert.deepEqual(result, { suggest: "cymbal ls", why: "indexed paths", tool: "Glob" });
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

test("nudge sends lower-case bash payload", async () => {
  const payloads = [];
  const hooks = createCymbalHooks({
    run: async (options) => {
      payloads.push(options.input);
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: "", stderr: "", code: 0 };
    },
  });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });
  assert.deepEqual(JSON.parse(payloads[0]), { tool_name: "bash", tool_input: { command: "rg -n auth ." } });
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

test("nudge runs read calls and stays silent on empty stdout", async () => {
  const payloads = [];
  const messages = [];
  const notifications = [];
  const hooks = createCymbalHooks({
    run: async (options) => {
      payloads.push(options.input);
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: "", stderr: "", code: 0 };
    },
    sendMessage: (message) => messages.push(message),
  });
  await hooks.handleToolCall(
    { toolName: "read", input: { path: "src/hooks.ts" } },
    { cwd: ".", hasUI: true, ui: { notify: (message, type) => notifications.push({ message, type }) } },
  );
  assert.deepEqual(JSON.parse(payloads[0]), { tool_name: "Read", tool_input: { file_path: "src/hooks.ts" } });
  assert.equal(messages.length, 0);
  assert.equal(notifications.length, 0);
});

test("nudge sends read payload and advisory when Cymbal suggests", async () => {
  const payloads = [];
  const messages = [];
  const hooks = createCymbalHooks({
    run: async (options) => {
      payloads.push(options.input);
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: '{"suggest":"Use cymbal_show src/hooks.ts","why":"focused read","tool":"cymbal_show"}', stderr: "", code: 0 };
    },
    sendMessage: (message) => messages.push(message),
  });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/hooks.ts" } }, { cwd: "." });
  assert.deepEqual(JSON.parse(payloads[0]), { tool_name: "Read", tool_input: { file_path: "src/hooks.ts" } });
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Use cymbal_show src\/hooks\.ts/);
});

test("empty read nudge output does not consume Read suppression slot", async () => {
  let calls = 0;
  const messages = [];
  const hooks = createCymbalHooks({
    run: async () => {
      calls += 1;
      const stdout = calls === 1 ? "" : '{"suggest":"Use cymbal_show src/hooks.ts","why":"focused read","tool":"cymbal_show"}';
      return { command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout, stderr: "", code: 0 };
    },
    sendMessage: (message) => messages.push(message),
  });

  await hooks.handleToolCall({ toolName: "read", input: { path: "README.md" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/hooks.ts" } }, { cwd: "." });

  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Use cymbal_show src\/hooks\.ts/);
});

test("nudge ignores unsupported tools and malformed input", async () => {
  let called = false;
  const hooks = createCymbalHooks({
    run: async () => { called = true; throw new Error("should not run"); },
  });
  await hooks.handleToolCall({ toolName: "write", input: { path: "file" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "grep", input: null }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth", literal: true } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "find", input: { pattern: "   " } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "read", input: { path: 123 } }, { cwd: "." });
  assert.equal(called, false);
});

test("nudge failures are swallowed", async () => {
  const failingRunHooks = createCymbalHooks({
    run: async () => { throw new Error("nudge failed"); },
    sendMessage: () => { throw new Error("should not send"); },
  });
  await failingRunHooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });

  const failingMessageHooks = createCymbalHooks({
    run: async () => ({ command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout: '{"suggest":"Use cymbal_search","why":"better index","tool":"cymbal_search"}', stderr: "", code: 0 }),
    sendMessage: () => { throw new Error("send failed"); },
  });
  await assert.doesNotReject(() => failingMessageHooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." }));
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
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth" } }, { cwd: "/repo-b" });
  currentTime += 1_001;
  await hooks.handleToolCall({ toolName: "grep", input: { pattern: "auth" } }, { cwd: "/repo-a" });

  assert.equal(messages.length, 3);
});

test("nudge suppresses distinct Read and Glob suggestions by tool class per cwd", async () => {
  let currentTime = 1_000;
  const messages = [];
  const hooks = createCymbalHooks({
    now: () => currentTime,
    run: async (options) => {
      const payload = JSON.parse(options.input);
      const target = payload.tool_input.file_path ?? payload.tool_input.pattern;
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: JSON.stringify({ suggest: `Use ${payload.tool_name} ${target}` }), stderr: "", code: 0 };
    },
    sendMessage: (message) => messages.push(message),
  });

  await hooks.handleToolCall({ toolName: "read", input: { path: "src/a.ts" } }, { cwd: "/repo-a" });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/b.ts" } }, { cwd: "/repo-a" });
  await hooks.handleToolCall({ toolName: "find", input: { pattern: "src/**/*.ts" } }, { cwd: "/repo-a" });
  await hooks.handleToolCall({ toolName: "find", input: { pattern: "test/**/*.ts" } }, { cwd: "/repo-a" });
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/b.ts" } }, { cwd: "/repo-b" });
  currentTime += 60_001;
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/c.ts" } }, { cwd: "/repo-a" });

  assert.equal(messages.length, 4);
  assert.match(messages[0].content, /Use Read src\/a\.ts/);
  assert.match(messages[1].content, /Use Glob src\/\*\*\/\*\.ts/);
  assert.match(messages[2].content, /Use Read src\/b\.ts/);
  assert.match(messages[3].content, /Use Read src\/c\.ts/);
});

test("concurrent identical nudges share one in-flight run", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const hooks = createCymbalHooks({
    run: async (options) => {
      calls += 1;
      await gate;
      return { command: "cymbal hook nudge", args: options.args, cwd: options.cwd, stdout: "", stderr: "", code: 0 };
    },
  });
  const event = { toolName: "bash", input: { command: "rg auth" } };
  const first = hooks.handleToolCall(event, { cwd: "/repo" });
  const second = hooks.handleToolCall(event, { cwd: "/repo" });
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
});

test("hook shutdown aborts and awaits tracked work", async () => {
  let observedSignal;
  const hooks = createCymbalHooks({
    run: async (options) => {
      observedSignal = options.signal;
      await new Promise((resolve) => options.signal.addEventListener("abort", resolve, { once: true }));
      throw options.signal.reason;
    },
  });
  hooks.startToolCall({ toolName: "bash", input: { command: "rg auth" } }, { cwd: "/repo" });
  await hooks.shutdown();
  assert.equal(observedSignal.aborted, true);
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
  await hooks.handleToolCall({ toolName: "read", input: { path: "src/hooks.ts" } }, { cwd: "." });
  await hooks.handleToolCall({ toolName: "find", input: { pattern: "**/*.ts" } }, { cwd: "." });

  assert.deepEqual(calls, [
    ["hook", "remind", "--format=text", "--update=if-stale"],
    ["hook", "nudge", "--format=json"],
    ["hook", "nudge", "--format=json"],
    ["hook", "nudge", "--format=json"],
  ]);
  assert.equal(calls.some((args) => args.includes("index")), false);
});
