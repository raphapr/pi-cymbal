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
    "cymbal_context",
    "cymbal_impact",
    "cymbal_impls",
    "cymbal_importers",
    "cymbal_investigate",
    "cymbal_map",
    "cymbal_outline",
    "cymbal_refs",
    "cymbal_search",
    "cymbal_show",
    "cymbal_trace",
  ]);
  assert.deepEqual(commands, ["cymbal:remind"]);
  assert.ok(events.includes("session_start"));
  assert.ok(events.includes("before_agent_start"));
  assert.ok(events.includes("tool_call"));
});
