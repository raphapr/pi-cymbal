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

  assert.deepEqual(calls[0].args, ["impact", "--context", "2", "--depth", "3", "--limit", "10", "--", "handleAuth", "saveAuth"]);
  assert.equal(calls[0].args.includes("--graph"), false);
  assert.equal(calls[0].args.includes("--include-unresolved"), false);
});

test("cymbal_impact parses deterministic default graph output as JSON", async () => {
  const pi = { registerTool(tool) { this.tool = tool; } };
  registerImpactTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { symbol: "handleAuth", graph: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => ({
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: '{"nodes":[]}',
        stderr: "",
        code: 0,
      }),
    },
  );

  assert.equal(result.details.outputFormat, "json");
  assert.equal(result.details.parsedJson, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { nodes: [] });
});
