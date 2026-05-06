import assert from "node:assert/strict";
import test from "node:test";
import { registerOutlineTool } from "../src/tools/outline.ts";

test("cymbal_outline runs one Cymbal command per file and combines output", async () => {
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerOutlineTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { files: ["@src/cymbal.ts", "src/tools/common.ts"], signatures: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: ".",
      runCymbal: async (options) => {
        calls.push(options.args);
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: `outline for ${options.args[1]}`,
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls, [
    ["outline", "src/cymbal.ts", "--signatures"],
    ["outline", "src/tools/common.ts", "--signatures"],
  ]);
  assert.match(result.content[0].text, /outline for src\/cymbal\.ts/);
  assert.match(result.content[0].text, /outline for src\/tools\/common\.ts/);
  assert.equal(result.details.commands.length, 2);
});
