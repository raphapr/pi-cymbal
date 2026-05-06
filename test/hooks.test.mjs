import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNudgePayload,
  createCymbalHooks,
  parseNudgeResponse,
} from "../src/hooks.ts";

test("buildNudgePayload wraps bash command", () => {
  assert.equal(buildNudgePayload("rg -n auth ."), JSON.stringify({ tool_name: "bash", tool_input: { command: "rg -n auth ." } }));
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
  await hooks.refreshReminder({ cwd: "." });
  assert.deepEqual(hooks.injectReminder({ systemPrompt: "Base" }), { systemPrompt: "Base" });
});

test("nudge sends steering message without blocking", async () => {
  const messages = [];
  const hooks = createCymbalHooks({
    run: async (_options) => ({ command: "cymbal hook nudge", args: ["hook", "nudge", "--format=json"], cwd: ".", stdout: '{"suggest":"Use cymbal_search","why":"better index","tool":"cymbal_search"}', stderr: "", code: 0 }),
    sendMessage: (message) => messages.push(message),
  });
  await hooks.handleToolCall({ toolName: "bash", input: { command: "rg -n auth ." } }, { cwd: "." });
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Use cymbal_search/);
});

test("nudge ignores non-bash tools", async () => {
  let called = false;
  const hooks = createCymbalHooks({
    run: async () => { called = true; throw new Error("should not run"); },
  });
  await hooks.handleToolCall({ toolName: "read", input: { path: "file" } }, { cwd: "." });
  assert.equal(called, false);
});
