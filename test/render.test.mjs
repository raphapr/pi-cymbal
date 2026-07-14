import assert from "node:assert/strict";
import test from "node:test";
import { renderCymbalResult } from "../src/render.ts";

function renderedStatus(status) {
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
    { expanded: false, isError: false },
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
