import assert from "node:assert/strict";
import test from "node:test";
import { registerImpactTool } from "../src/tools/impact.ts";

test("cymbal_impact passes batch symbols and context without graph flags", async () => {
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerImpactTool(pi);

  await pi.tool.execute(
    "call-1",
    { symbol: "handleAuth", symbols: ["saveAuth"], context: 2, depth: 3, limit: 10, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options);
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "impact output",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls[0].args, ["impact", "handleAuth", "saveAuth", "--context", "2", "--depth", "3", "--limit", "10"]);
  assert.equal(calls[0].args.includes("--graph"), false);
  assert.equal(calls[0].args.includes("--include-unresolved"), false);
});
