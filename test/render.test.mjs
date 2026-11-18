import assert from "node:assert/strict";
import test from "node:test";
import { renderCymbalResult } from "../src/render.ts";

function renderedStatus(status, context = {}) {
  const slots = [];
  const theme = {
    fg(slot, text) { slots.push(slot); return text; },
    bold(text) { return text; },
  };
  const component = renderCymbalResult(
    {
      content: [{ type: "text", text: "output" }],
      details: { command: "cymbal x", args: ["x"], cwd: ".", exitCode: 0, outputFormat: "agent", status, truncated: false },
    },
    { expanded: false, isPartial: false },
    theme,
    { expanded: false, isError: false, ...context },
  );
  return { text: component.render(200).join("\n"), slots };
}

for (const status of ["partial", "empty", "unsupported"]) {
  test(`renderer displays ${status} as a warning`, () => {
    const result = renderedStatus(status);
    assert.match(result.text, /^! /);
    assert.ok(result.slots.includes("warning"));
  });
}

test("renderer takes the expand hint from the render context", () => {
  const calls = [];
  const result = renderedStatus("ok", {
    keyHint(keybinding, description) { calls.push(keybinding); return `ctrl+o ${description}`; },
  });
  assert.deepEqual(calls, ["app.tools.expand"]);
  assert.match(result.text, /· ctrl\+o to expand\s*$/);
});
