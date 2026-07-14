import assert from "node:assert/strict";
import test from "node:test";
import { CymbalError, ProcessError } from "../src/cymbal.ts";
import { clearAvailabilityCache, ensureCommandAvailable, registerOptionalTools } from "../src/tools/optional.ts";

test("ensureCommandAvailable returns when help succeeds", async () => {
  await ensureCommandAvailable("trace", async () => ({ command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "usage", stderr: "", code: 0 }), ".");
});

test("ensureCommandAvailable throws clear unsupported error only for known diagnostics", async () => {
  const unsupported = new ProcessError("failed", {
    command: "cymbal trace --help",
    args: ["trace", "--help"],
    cwd: ".",
    stdout: "",
    stderr: "Error: unknown command 'trace'",
    code: 1,
  });
  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw unsupported; }, "."),
    /does not support `cymbal trace`/,
  );
  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw new Error("permission denied"); }, "."),
    /permission denied/,
  );
});

test("ensureCommandAvailable caches concurrent successful probes", async () => {
  clearAvailabilityCache();
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const runner = async () => {
    calls += 1;
    await gate;
    return { command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "usage", stderr: "", code: 0 };
  };
  const first = ensureCommandAvailable("trace", runner, ".");
  const second = ensureCommandAvailable("trace", runner, ".");
  release();
  await Promise.all([first, second]);
  await ensureCommandAvailable("trace", runner, ".");
  assert.equal(calls, 1);
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

test("ensureCommandAvailable preserves aborted preflight errors", async () => {
  const controller = new AbortController();
  controller.abort();
  const aborted = new Error("cymbal trace --help aborted");

  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw aborted; }, ".", controller.signal),
    /aborted/,
  );
});

test("ensureCommandAvailable preserves timeout process errors", async () => {
  const timeout = new ProcessError("cymbal trace --help timed out", { command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "", stderr: "", code: 124 });

  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw timeout; }, "."),
    /timed out/,
  );
});

test("ensureCommandAvailable preserves interrupted Cymbal errors", async () => {
  const processError = new ProcessError("cymbal trace --help aborted", { command: "cymbal trace --help", args: ["trace", "--help"], cwd: ".", stdout: "", stderr: "", code: 1 });
  const cymbalError = new CymbalError("cymbal trace --help failed (exit 1).", processError.result, processError);

  await assert.rejects(
    () => ensureCommandAvailable("trace", async () => { throw cymbalError; }, "."),
    (error) => error === cymbalError,
  );
});

test("optional tools pass command-specific parameters", async () => {
  const calls = [];
  const pi = {
    tools: {},
    registerTool(tool) {
      this.tools[tool.name] = tool;
    },
  };

  registerOptionalTools(pi);

  const ctx = {
    cwd: process.cwd(),
    runCymbal: async (options) => {
      calls.push(options.args);
      if (options.args[1] === "--help") {
        return { command: `cymbal ${options.args.join(" ")}`, args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
      }
      return { command: `cymbal ${options.args.join(" ")}`, args: options.args, cwd: options.cwd, stdout: "optional output", stderr: "", code: 0 };
    },
  };

  await pi.tools.cymbal_investigate.execute("call-1", { symbol: "one", symbols: ["two"], format: "agent" }, undefined, undefined, ctx);
  await pi.tools.cymbal_trace.execute("call-2", { symbol: "one", symbols: ["two"], depth: 3, kinds: "call,use", limit: 4, format: "agent" }, undefined, undefined, ctx);
  await pi.tools.cymbal_context.execute("call-3", { symbol: "one", callers: 5, format: "agent" }, undefined, undefined, ctx);

  assert.deepEqual(calls, [
    ["investigate", "--help"],
    ["investigate", "--", "one", "two"],
    ["trace", "--help"],
    ["trace", "--depth", "3", "--kinds", "call,use", "--limit", "4", "--", "one", "two"],
    ["context", "--help"],
    ["context", "--callers", "5", "--", "one"],
  ]);
});

test("optional tools return structured unsupported results", async () => {
  clearAvailabilityCache();
  const pi = { tools: {}, registerTool(tool) { this.tools[tool.name] = tool; } };
  registerOptionalTools(pi);

  const result = await pi.tools.cymbal_trace.execute(
    "call-1",
    { symbol: "x", format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        throw new ProcessError("failed", {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "",
          stderr: "Error: unknown command 'trace'",
          code: 1,
        });
      },
    },
  );

  assert.equal(result.details.status, "unsupported");
  assert.deepEqual(JSON.parse(result.content[0].text), {
    results: {},
    status: "unsupported",
    command: "trace",
    diagnostics: ["Error: unknown command 'trace'", "failed"],
  });
});

test("optional trace treats default graph output as JSON", async () => {
  clearAvailabilityCache();
  const pi = { tools: {}, registerTool(tool) { this.tools[tool.name] = tool; } };
  registerOptionalTools(pi);

  const result = await pi.tools.cymbal_trace.execute(
    "call-1",
    { symbol: "x", graph: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => ({
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: options.args[1] === "--help" ? "usage" : '{"nodes":[]}',
        stderr: "",
        code: 0,
      }),
    },
  );

  assert.equal(result.details.outputFormat, "json");
  assert.equal(result.details.parsedJson, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { nodes: [] });
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
