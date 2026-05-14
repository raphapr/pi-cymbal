import assert from "node:assert/strict";
import test from "node:test";
import { Type } from "typebox";
import { ProcessError } from "../src/cymbal.ts";
import { registerCymbalTool } from "../src/tools/common.ts";

function registerFakeTool(runCymbal, options = {}) {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerCymbalTool(pi, {
    name: "cymbal_fake",
    label: "Cymbal Fake",
    description: "Fake Cymbal tool for common wrapper tests.",
    parameters: Type.Object({
      target: Type.String(),
      format: Type.Optional(Type.String()),
    }),
    buildArgs: (params) => [options.command ?? "refs", params.target, ...(params.format === "json" ? ["--json"] : [])],
    recoverTarget: (params) => params.target,
    promptSnippet: "fake",
    promptGuidelines: [],
  });

  return { pi, ctx: { cwd: process.cwd(), runCymbal } };
}

test("registerCymbalTool returns JSON for empty no-result output", async () => {
  const { pi, ctx } = registerFakeTool(async (options) => ({
    command: `cymbal ${options.args.join(" ")}`,
    args: options.args,
    cwd: options.cwd,
    stdout: "",
    stderr: "No references found for 'definitely_missing_symbol_zzzz'.\n",
    code: 0,
  }));

  const result = await pi.tool.execute("call-1", { target: "definitely_missing_symbol_zzzz", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "not_found");
  assert.equal(result.details.parsedJson, true);
  assert.equal(JSON.parse(result.content[0].text).status, "not_found");
});

test("registerCymbalTool preserves exit-zero no-repo diagnostics as JSON", async () => {
  const { pi, ctx } = registerFakeTool(async (options) => ({
    command: `cymbal ${options.args.join(" ")}`,
    args: options.args,
    cwd: options.cwd,
    stdout: "",
    stderr: "Warning: not inside a git repository — results may be empty.\nNo references found for 'definitely_missing_symbol_zzzz'.\n",
    code: 0,
  }));

  const result = await pi.tool.execute("call-1", { target: "definitely_missing_symbol_zzzz", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "no_repo");
  assert.equal(result.details.parsedJson, true);
  assert.equal(JSON.parse(result.content[0].text).status, "no_repo");
});

test("registerCymbalTool recovers importers no-result errors", async () => {
  const { pi, ctx } = registerFakeTool(
    async (options) => {
      throw new ProcessError("cymbal importers failed", {
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: "",
        stderr: "Error: no importers found for 'definitely_missing_file_zzzz.ts'\n",
        code: 1,
      });
    },
    { command: "importers" },
  );

  const result = await pi.tool.execute("call-1", { target: "definitely_missing_file_zzzz.ts", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "not_found");
  assert.equal(result.details.parsedJson, true);
  assert.equal(JSON.parse(result.content[0].text).status, "not_found");
});
