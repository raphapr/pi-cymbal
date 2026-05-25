import assert from "node:assert/strict";
import test from "node:test";
import { ProcessError } from "../src/cymbal.ts";
import { registerDiffTool } from "../src/tools/diff.ts";

function registerTool() {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };
  registerDiffTool(pi);
  return pi.tool;
}

test("cymbal_diff checks availability and runs diff", async () => {
  const calls = [];
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { symbol: "buildSearchArgs", base: "main", stat: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options);
        if (options.args[0] === "diff" && options.args[1] === "--help") {
          return { command: "cymbal diff --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "diff output",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls.map((call) => call.args), [["diff", "--help"], ["diff", "buildSearchArgs", "main", "--stat"]]);
  assert.equal(result.content[0].text, "diff output");
});

test("cymbal_diff reports unsupported command clearly", async () => {
  const tool = registerTool();

  await assert.rejects(
    () => tool.execute(
      "call-1",
      { symbol: "Missing" },
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        runCymbal: async () => { throw new Error("unknown command"); },
      },
    ),
    /does not support `cymbal diff`/,
  );
});

test("cymbal_diff recovers missing symbol output", async () => {
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { symbol: "DefinitelyMissingSymbol", format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        if (options.args[0] === "diff" && options.args[1] === "--help") {
          return { command: "cymbal diff --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        throw new ProcessError("cymbal diff failed", {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "",
          stderr: "symbol not found: DefinitelyMissingSymbol\n",
          code: 1,
        });
      },
    },
  );

  assert.equal(result.details.status, "not_found");
  assert.equal(result.details.requestedTarget, "DefinitelyMissingSymbol");
  assert.equal(JSON.parse(result.content[0].text).status, "not_found");
});
