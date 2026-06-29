import assert from "node:assert/strict";
import test from "node:test";
import { registerChangedTool } from "../src/tools/changed.ts";

function registerTool() {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };
  registerChangedTool(pi);
  return pi.tool;
}

test("cymbal_changed checks availability before running changed", async () => {
  const calls = [];
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { staged: true, noTests: true, resolveScope: "family", format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options);
        if (options.args[0] === "changed" && options.args[1] === "--help") {
          return { command: "cymbal changed --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "impacted symbols",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls.map((call) => call.args), [
    ["changed", "--help"],
    ["changed", "--staged", "--no-tests", "--resolve-scope", "family"],
  ]);
  assert.equal(result.content[0].text, "impacted symbols");
});

test("cymbal_changed reports unsupported command clearly", async () => {
  const tool = registerTool();

  await assert.rejects(
    () => tool.execute(
      "call-1",
      {},
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        runCymbal: async () => { throw new Error("unknown command"); },
      },
    ),
    /does not support `cymbal changed`/,
  );
});

// Empty-diff in text/agent mode: cymbal writes the sentence to STDERR (not stdout)
// and exits 0, so stdout is empty. visibleOutput joins stdout+stderr, so the
// /no changed symbols found/i pattern in isNotFoundOutput fires and normalizes.
test("cymbal_changed normalizes an empty diff to not_found (agent mode, phrase on stderr)", async () => {
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        if (options.args[1] === "--help") {
          return { command: "cymbal changed --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "",
          stderr: "No changed symbols found in the diff.\n",
          code: 0,
        };
      },
    },
  );

  assert.equal(result.details.status, "not_found");
  assert.match(result.content[0].text, /No changed symbols found in the diff\./);
});

// Empty-diff in --json mode: cymbal returns a real JSON payload (changed_symbols: 0)
// on stdout, so there is nothing to normalize. The agent receives the payload
// verbatim and the status stays ok. (Normalization stays shape-agnostic.)
test("cymbal_changed passes an empty-diff JSON payload through unchanged (json mode)", async () => {
  const tool = registerTool();
  // Real v0.14.0 `cymbal changed --json` envelope on an empty diff (verified live):
  // a top-level { results: <payload>, version } wrapper, with results: null inside.
  const emptyPayload = JSON.stringify({
    results: {
      analyzed: 0,
      base: "working tree",
      changed_symbols: 0,
      resolve_scope: "family",
      results: null,
      truncated: false,
    },
    version: "0.1",
  });

  const result = await tool.execute(
    "call-1",
    { format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        if (options.args[1] === "--help") {
          return { command: "cymbal changed --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: emptyPayload,
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.equal(result.details.status, "ok");
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.version, "0.1");
  assert.equal(payload.results.changed_symbols, 0);
  assert.equal(payload.results.results, null);
});
