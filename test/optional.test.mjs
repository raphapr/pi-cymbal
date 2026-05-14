import assert from "node:assert/strict";
import test from "node:test";
import { CymbalError } from "../src/cymbal.ts";
import { ensureCommandAvailable, registerOptionalTools } from "../src/tools/optional.ts";

test("ensureCommandAvailable returns when help succeeds", async () => {
  await ensureCommandAvailable("trace", async () => ({ command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "usage", stderr: "", code: 0 }), ".");
});

test("ensureCommandAvailable throws clear unsupported error", async () => {
  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw new Error("unknown command"); }, "."),
    /does not support `cymbal trace`/,
  );
});

test("ensureCommandAvailable preserves missing Cymbal guidance", async () => {
  const missing = new CymbalError("Cymbal is unavailable", { command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "", stderr: "", code: 127 });
  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw missing; }, "."),
    /Cymbal is unavailable/,
  );
});

test("ensureCommandAvailable passes abort signal to preflight", async () => {
  const controller = new AbortController();
  await ensureCommandAvailable("trace", async (options) => {
    assert.equal(options.signal, controller.signal);
    return { command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "usage", stderr: "", code: 0 };
  }, ".", controller.signal);
});

test("optional tools normalize no-result JSON output", async () => {
  const pi = {
    tools: {},
    registerTool(tool) {
      this.tools[tool.name] = tool;
    },
  };

  registerOptionalTools(pi);

  const result = await pi.tools.cymbal_trace.execute(
    "call-1",
    { symbol: "definitely_missing_symbol_zzzz", format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        if (options.args[0] === "trace" && options.args[1] === "--help") {
          return { command: "cymbal trace --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "No outgoing calls found for 'definitely_missing_symbol_zzzz'.\n",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.equal(result.details.status, "not_found");
  assert.equal(result.details.parsedJson, true);
  assert.equal(JSON.parse(result.content[0].text).status, "not_found");
});

test("optional tools normalize no-result agent output", async () => {
  const pi = {
    tools: {},
    registerTool(tool) {
      this.tools[tool.name] = tool;
    },
  };

  registerOptionalTools(pi);

  const result = await pi.tools.cymbal_trace.execute(
    "call-1",
    { symbol: "definitely_missing_symbol_zzzz", format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        if (options.args[0] === "trace" && options.args[1] === "--help") {
          return { command: "cymbal trace --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "No outgoing calls found for 'definitely_missing_symbol_zzzz'.\n",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.equal(result.details.status, "not_found");
});
