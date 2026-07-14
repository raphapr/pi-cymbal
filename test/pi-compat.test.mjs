import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const expectedTools = [
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
];

test("package declares a Pi extension manifest", async () => {
  const packageJson = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
  const extensionPath = packageJson.pi?.extensions?.[0];

  assert.ok(packageJson.keywords.includes("pi-package"));
  assert.equal(extensionPath, "./src/index.ts");
  assert.equal(packageJson.pi.image, "https://raw.githubusercontent.com/raphapr/pi-cymbal/main/assets/pi-cymbal-gallery.png");
  assert.ok(packageJson.files.includes("assets/"));

  const extension = await import(resolve(process.cwd(), extensionPath));
  assert.equal(typeof extension.default, "function");
});

test("package-baseline Pi API registers the complete extension surface", async () => {
  const packageJson = JSON.parse(await readFile(resolve(process.cwd(), "package.json"), "utf8"));
  const extension = await import(resolve(process.cwd(), packageJson.pi.extensions[0]));
  const tools = [];
  const commands = [];
  const events = [];
  const pi = {
    registerTool(tool) {
      tools.push(tool.name);
    },
    registerCommand(name) {
      commands.push(name);
    },
    on(name) {
      events.push(name);
    },
    sendMessage() {},
  };

  assert.doesNotThrow(() => extension.default(pi));
  assert.deepEqual(tools.sort(), expectedTools);
  assert.deepEqual(commands, ["cymbal:remind"]);
  for (const event of ["session_start", "session_shutdown", "before_agent_start", "tool_call", "tool_execution_start"]) {
    assert.ok(events.includes(event), `missing ${event} registration`);
  }
});
