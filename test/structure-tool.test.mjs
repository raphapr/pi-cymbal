import assert from "node:assert/strict";
import test from "node:test";
import { ProcessError } from "../src/cymbal.ts";
import { registerStructureTool } from "../src/tools/structure.ts";

function registerTool() {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };
  registerStructureTool(pi);
  return pi.tool;
}

test("cymbal_structure checks availability and runs structure", async () => {
  const calls = [];
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { limit: 3, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options);
        if (options.args[0] === "structure" && options.args[1] === "--help") {
          return { command: "cymbal structure --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "structure output",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls.map((call) => call.args), [["structure", "--help"], ["structure", "--limit", "3"]]);
  assert.equal(result.content[0].text, "structure output");
});

test("cymbal_structure returns a structured unsupported result", async () => {
  const tool = registerTool();
  const result = await tool.execute("call-1", {}, undefined, undefined, {
    cwd: process.cwd(),
    runCymbal: async (options) => {
      throw new ProcessError("failed", { command: "cymbal structure --help", args: options.args, cwd: options.cwd, stdout: "", stderr: "Error: unknown command 'structure'", code: 1 });
    },
  });
  assert.equal(result.details.status, "unsupported");
  assert.match(result.content[0].text, /does not support `cymbal structure`/);
});
