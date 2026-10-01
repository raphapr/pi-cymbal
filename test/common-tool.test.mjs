import assert from "node:assert/strict";
import test from "node:test";
import { Type } from "typebox";
import { ProcessError } from "../src/cymbal.ts";
import { registerCymbalTool } from "../src/tools/common.ts";

const theme = {
  fg: (_slot, text) => text,
  bold: (text) => text,
};

function render(component) {
  return component.render(200).map((line) => line.trimEnd()).join("\n");
}

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

test("registerCymbalTool renders collapsed calls without raw JSON", () => {
  const { pi } = registerFakeTool(async () => {
    throw new Error("not executed");
  });

  const collapsed = render(
    pi.tool.renderCall(
      { target: "SomeSymbol", format: "json" },
      theme,
      { expanded: false },
    ),
  );
  const expanded = render(
    pi.tool.renderCall(
      { target: "SomeSymbol", format: "json" },
      theme,
      { expanded: true },
    ),
  );

  assert.equal(collapsed, 'cymbal_fake target="SomeSymbol" format="json"');
  assert.match(expanded, /"target": "SomeSymbol"/);
});

test("registerCymbalTool renders collapsed results as summaries", async () => {
  const { pi, ctx } = registerFakeTool(async (options) => ({
    command: `cymbal ${options.args.join(" ")}`,
    args: options.args,
    cwd: options.cwd,
    stdout: "first line\nsecond line\n",
    stderr: "",
    code: 0,
  }));
  const result = await pi.tool.execute("call-1", { target: "SomeSymbol" }, undefined, undefined, ctx);

  const collapsed = render(
    pi.tool.renderResult(
      result,
      { expanded: false, isPartial: false },
      theme,
      { expanded: false, isError: false },
    ),
  );
  const expanded = render(
    pi.tool.renderResult(
      result,
      { expanded: true, isPartial: false },
      theme,
      { expanded: true, isError: false },
    ),
  );

  assert.match(collapsed, /ok/);
  assert.match(collapsed, /2 lines/);
  assert.match(collapsed, /expand/);
  assert.doesNotMatch(collapsed, /first line/);
  assert.match(expanded, /first line\nsecond line/);
});

test("registerCymbalTool returns JSON for empty no-result output", async () => {
  const { pi, ctx } = registerFakeTool(async (options) => ({
    command: `cymbal ${options.args.join(" ")}`,
    args: options.args,
    cwd: options.cwd,
    stdout: "",
    stderr: "No changed symbols found.\n",
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

function partialBatchFailure(stdout) {
  return async (options) => {
    throw new ProcessError("cymbal impact failed", {
      command: `cymbal ${options.args.join(" ")}`,
      args: options.args,
      cwd: options.cwd,
      stdout,
      stderr: "Error: symbol not found: nope\n",
      code: 1,
    });
  };
}

test("registerCymbalTool keeps resolved agent output when a batch name is missing", async () => {
  const stdout = "---\nsymbol: lonely\ntotal_callers: 0\n---\n";
  const { pi, ctx } = registerFakeTool(partialBatchFailure(stdout), { command: "impact" });

  const result = await pi.tool.execute("call-1", { target: "lonely" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "partial");
  assert.deepEqual(result.details.diagnostics, ["Error: symbol not found: nope"]);
  assert.equal(result.content[0].text, `${stdout}\nError: symbol not found: nope\n`);
});

test("registerCymbalTool keeps resolved JSON output when a batch name is missing", async () => {
  const payload = { results: { symbols: ["lonely"], total_callers: 0, results: [] }, version: "0.1" };
  const { pi, ctx } = registerFakeTool(partialBatchFailure(`${JSON.stringify(payload)}\n`), { command: "impact" });

  const result = await pi.tool.execute("call-1", { target: "lonely", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "partial");
  assert.equal(result.details.parsedJson, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { ...payload, status: "partial", diagnostics: ["Error: symbol not found: nope"] });
});

test("registerCymbalTool reports not_found when every batch name is missing", async () => {
  const { pi, ctx } = registerFakeTool(partialBatchFailure(""), { command: "impact" });

  const result = await pi.tool.execute("call-1", { target: "nope", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "not_found");
});

test("registerCymbalTool passes zero-count results through", async () => {
  const stdout = "---\nsymbol: lonely\nref_count: 0\n---\n";
  const { pi, ctx } = registerFakeTool(async (options) => ({ command: "cymbal refs", args: options.args, cwd: options.cwd, stdout, stderr: "", code: 0 }));

  const result = await pi.tool.execute("call-1", { target: "lonely" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "ok");
  assert.equal(result.content[0].text, stdout);
});

test("registerCymbalTool reports not_found when every JSON entry errored", async () => {
  const payload = { results: { nope: { error: "symbol not found: nope" }, zip: { error: "symbol not found: zip" } }, version: "0.1" };
  const { pi, ctx } = registerFakeTool(partialBatchFailure(`${JSON.stringify(payload)}\n`), { command: "impls" });

  const result = await pi.tool.execute("call-1", { target: "nope", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "not_found");
});

test("registerCymbalTool keeps unparsable JSON from a partial batch", async () => {
  const { pi, ctx } = registerFakeTool(partialBatchFailure('{"results": {"symbols": ["lonely"]'), { command: "impact" });

  const result = await pi.tool.execute("call-1", { target: "lonely", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "error");
  assert.equal(result.details.error.code, "malformed_cymbal_json");
  assert.match(JSON.parse(result.content[0].text).preview, /lonely/);
});

test("registerCymbalTool still recovers pre-v0.17 empty-result errors", async () => {
  const { pi, ctx } = registerFakeTool(
    async (options) => {
      throw new ProcessError("cymbal impact failed", {
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: "",
        stderr: "Error: no callers found for 'lonely'\n",
        code: 1,
      });
    },
    { command: "impact" },
  );

  const result = await pi.tool.execute("call-1", { target: "lonely", format: "json" }, undefined, undefined, ctx);

  assert.equal(result.details.status, "not_found");
});
