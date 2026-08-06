import assert from "node:assert/strict";
import test from "node:test";
import extension from "../src/index.ts";

test("extension registers expected tools and command", () => {
  const tools = [];
  const commands = [];
  const events = [];
  const pi = {
    registerTool(tool) { tools.push(tool.name); },
    registerCommand(name) { commands.push(name); },
    on(name) { events.push(name); },
  };

  extension(pi);

  assert.deepEqual(tools.sort(), [
    "cymbal_changed",
    "cymbal_context",
    "cymbal_diff",
    "cymbal_impact",
    "cymbal_impls",
    "cymbal_importers",
    "cymbal_index",
    "cymbal_investigate",
    "cymbal_map",
    "cymbal_outline",
    "cymbal_refs",
    "cymbal_search",
    "cymbal_show",
    "cymbal_structure",
    "cymbal_trace",
  ]);
  assert.deepEqual(commands, ["cymbal"]);
  assert.ok(events.includes("session_start"));
  assert.ok(events.includes("before_agent_start"));
  assert.ok(events.includes("tool_call"));
  assert.ok(events.includes("tool_execution_start"));
  assert.ok(events.includes("session_shutdown"));
});

test("guidance command changes session-only settings", async () => {
  const commands = new Map();
  const notifications = [];
  const pi = {
    registerTool() {},
    registerCommand(name, command) { commands.set(name, command); },
    on() {},
    sendMessage() {},
    getActiveTools() { return ["cymbal_show"]; },
  };
  const ctx = { cwd: process.cwd(), ui: { notify(message, type) { notifications.push([message, type]); } } };

  extension(pi);
  await commands.get("cymbal").handler("off", ctx);
  await commands.get("cymbal").handler("nudges on", ctx);
  await commands.get("cymbal").handler("status", ctx);

  assert.deepEqual(notifications[0], ["Cymbal disabled for this session", "info"]);
  assert.deepEqual(notifications.at(-1), ["Cymbal system prompt: off; nudges: on", "info"]);
});

test("all cymbal tools define compact renderers", () => {
  const tools = [];
  const pi = {
    registerTool(tool) { tools.push(tool); },
    registerCommand() {},
    on() {},
  };

  extension(pi);

  for (const tool of tools) {
    assert.equal(typeof tool.renderCall, "function", `${tool.name} missing renderCall`);
    assert.equal(typeof tool.renderResult, "function", `${tool.name} missing renderResult`);
  }
});

test("registered tool_call starts work synchronously and shutdown awaits it", async () => {
  const handlers = new Map();
  const pi = {
    registerTool() {},
    registerCommand() {},
    on(name, handler) { handlers.set(name, handler); },
    sendMessage() {},
  };
  extension(pi);
  const returned = handlers.get("tool_call")({ toolName: "write", input: {} }, { cwd: process.cwd() });
  assert.equal(returned, undefined);
  await handlers.get("session_shutdown")();
});

test("cymbal tool executions reset global expansion", () => {
  const handlers = new Map();
  const pi = {
    registerTool() {},
    registerCommand() {},
    on(name, handler) { handlers.set(name, handler); },
  };
  const expanded = [];
  const ctx = {
    cwd: process.cwd(),
    ui: { setToolsExpanded(value) { expanded.push(value); } },
  };

  extension(pi);

  handlers.get("tool_execution_start")({ toolName: "cymbal_show" }, ctx);
  handlers.get("tool_execution_start")({ toolName: "read" }, ctx);

  assert.deepEqual(expanded, [false]);
});
