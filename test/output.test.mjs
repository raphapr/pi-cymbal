import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { formatCymbalOutput } from "../src/output.ts";

test("formatCymbalOutput preserves agent-native text", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal show x", args: ["show", "x"], cwd: ".", stdout: "---\nsymbol: x\n---\nbody", stderr: "", code: 0 },
    format: "agent",
  });
  assert.equal(result.content[0].text, "---\nsymbol: x\n---\nbody");
  assert.equal(result.details.outputFormat, "agent");
  assert.deepEqual(result.details.args, ["show", "x"]);
  assert.equal(result.details.exitCode, 0);
});

test("formatCymbalOutput pretty prints json output", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal version --json", args: ["version", "--json"], cwd: ".", stdout: "{\"ok\":true}", stderr: "", code: 0 },
    format: "json",
  });
  assert.equal(result.content[0].text, "{\n  \"ok\": true\n}");
  assert.equal(result.details.parsedJson, true);
});

test("formatCymbalOutput falls back to text when json parse fails", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal search x --json", args: ["search", "x", "--json"], cwd: ".", stdout: "not json", stderr: "", code: 0 },
    format: "json",
  });
  assert.equal(result.content[0].text, "not json");
  assert.equal(result.details.parsedJson, false);
});

test("formatCymbalOutput truncates large output and writes full text", async () => {
  const text = `${"x".repeat(60_000)}\n`;
  const result = await formatCymbalOutput({
    result: { command: "cymbal show big", args: ["show", "big"], cwd: ".", stdout: text, stderr: "", code: 0 },
    format: "agent",
    maxBytes: 1024,
    maxLines: 2000,
  });
  assert.match(result.content[0].text, /Output truncated/);
  assert.equal(result.details.truncated, true);
  assert.ok(result.details.fullOutputPath);
  assert.equal(await readFile(result.details.fullOutputPath, "utf8"), text);
});
