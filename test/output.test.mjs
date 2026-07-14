import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";
import { formatCymbalBatch, formatCymbalOutput } from "../src/output.ts";
import { cleanupSpills, createBoundedCapture, startSpillSession, stopSpillSession, trackSpillFinalizer, writeManagedSpill } from "../src/spill.ts";

test("formatCymbalOutput preserves agent-native text", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal show x", args: ["show", "x"], cwd: ".", stdout: "---\nsymbol: x\n---\nbody", stderr: "", code: 0 },
    format: "agent",
  });
  assert.equal(result.content[0].text, "---\nsymbol: x\n---\nbody");
  assert.equal(result.details.outputFormat, "agent");
  assert.deepEqual(result.details.args, ["show", "x"]);
  assert.equal(result.details.exitCode, 0);
});

test("formatCymbalOutput pretty prints json output", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal version --json", args: ["version", "--json"], cwd: ".", stdout: "{\"ok\":true}", stderr: "", code: 0 },
    format: "json",
  });
  assert.equal(result.content[0].text, "{\n  \"ok\": true\n}");
  assert.equal(result.details.parsedJson, true);
});

test("formatCymbalOutput wraps malformed native JSON as an exact error envelope", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal search x --json", args: ["search", "x", "--json"], cwd: ".", stdout: "not json", stderr: "", code: 0 },
    format: "json",
  });
  assert.deepEqual(JSON.parse(result.content[0].text), {
    results: {},
    status: "error",
    error: {
      code: "malformed_cymbal_json",
      message: "Cymbal returned malformed JSON.",
    },
    preview: "not json",
  });
  assert.equal(result.details.status, "error");
  assert.equal(result.details.parsedJson, false);
});

test("formatCymbalOutput keeps JSON envelopes valid and within final budgets", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal search x --json", args: ["search", "x", "--json"], cwd: ".", stdout: `bad ${"😀".repeat(100)}`, stderr: "", code: 0 },
    format: "json",
    maxBytes: 180,
    maxLines: 1,
  });
  assert.doesNotThrow(() => JSON.parse(result.content[0].text));
  assert.ok(Buffer.byteLength(result.content[0].text) <= 180);
  assert.ok(result.content[0].text.split("\n").length <= 1);
});

test("formatCymbalOutput rejects budgets below the minimum JSON envelope", async () => {
  await assert.rejects(
    () => formatCymbalOutput({
      result: { command: "cymbal x", args: ["x"], cwd: ".", stdout: "{}", stderr: "", code: 0 },
      format: "json",
      maxBytes: 5,
      maxLines: 1,
    }),
    RangeError,
  );
});

test("formatCymbalOutput truncates large output and writes full text", async () => {
  const text = `${"x".repeat(60_000)}\n`;
  const result = await formatCymbalOutput({
    result: { command: "cymbal show big", args: ["show", "big"], cwd: ".", stdout: text, stderr: "", code: 0 },
    format: "agent",
    maxBytes: 1024,
    maxLines: 2000,
  });
  assert.match(result.content[0].text, /Output truncated/);
  assert.equal(result.details.truncated, true);
  assert.ok(result.details.fullOutputPath);
  assert.equal(await readFile(result.details.fullOutputPath, "utf8"), text);
});

test("formatCymbalBatch applies one final bounded JSON envelope", async () => {
  const items = ["first", "second"].map((target, index) => ({
    target,
    result: {
      command: `cymbal outline -- ${target}`,
      args: ["outline", "--", target],
      cwd: ".",
      stdout: JSON.stringify({ target, body: "x".repeat(400) }),
      stderr: "",
      code: 0,
    },
  }));

  const result = await formatCymbalBatch({ items, format: "json", maxBytes: 700, maxLines: 20 });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.status, "partial");
  assert.equal(payload.error.code, "cymbal_json_output_limited");
  assert.ok(Buffer.byteLength(result.content[0].text) <= 700);
  assert.ok(result.details.fullOutputPath);
  const complete = JSON.parse(await readFile(result.details.fullOutputPath, "utf8"));
  assert.deepEqual(complete.results.map((item) => item.target), ["first", "second"]);
});

test("formatCymbalBatch preserves malformed entry previews and nested errors", async () => {
  const items = [
    { target: "ok", result: { command: "cymbal show ok", args: ["show", "--", "ok"], cwd: ".", stdout: "{\"ok\":true}", stderr: "", code: 0 } },
    { target: "bad", result: { command: "cymbal show bad", args: ["show", "--", "bad"], cwd: ".", stdout: "not json", stderr: "", code: 0 } },
  ];
  const result = await formatCymbalBatch({ items, format: "json" });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.results[1].preview, "not json");
  assert.equal(payload.results[1].error.code, "malformed_cymbal_json");
  assert.equal(payload.results[1].details.error.code, "malformed_cymbal_json");
});

test("minimum JSON fallback spills the complete wrapper separately from raw capture", async () => {
  const rawPath = "/tmp/pi-cymbal-raw-capture.json";
  const result = await formatCymbalOutput({
    result: {
      command: `cymbal ${"x".repeat(200)}`,
      args: ["search", "x"],
      cwd: ".",
      stdout: "not json",
      stderr: "",
      code: 0,
      stdoutPath: rawPath,
    },
    format: "json",
    maxBytes: Buffer.byteLength('{"status":"error"}'),
    maxLines: 1,
  });
  assert.equal(result.content[0].text, '{"status":"error"}');
  assert.equal(result.details.sourceOutputPath, rawPath);
  assert.notEqual(result.details.fullOutputPath, rawPath);
  const completeWrapper = await readFile(result.details.fullOutputPath, "utf8");
  assert.doesNotThrow(() => JSON.parse(completeWrapper));
});

test("cleanupSpills removes managed formatter output", async () => {
  const result = await formatCymbalOutput({
    result: { command: "cymbal show big", args: ["show", "--", "big"], cwd: ".", stdout: "x".repeat(200), stderr: "", code: 0 },
    format: "agent",
    maxBytes: 80,
    maxLines: 10,
  });
  const path = result.details.fullOutputPath;
  assert.ok(path);
  await cleanupSpills();
  await assert.rejects(() => access(path));
  await assert.doesNotReject(() => cleanupSpills());
});

test("cleanupSpills waits for active process captures", async () => {
  const capture = createBoundedCapture({ label: "active.txt", maxBytes: 1 });
  capture.append(Buffer.from("active"));
  let settled = false;
  const cleanup = cleanupSpills().then(() => {
    settled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(settled, false);
  capture.close();
  await cleanup;
  assert.equal(settled, true);
});

test("cleanupSpills removes artifacts even when an active finalizer rejects", async () => {
  const path = await writeManagedSpill("cleanup", "rejecting-finalizer.txt");
  const failure = trackSpillFinalizer(Promise.reject(new Error("finalizer failed")));
  void failure.catch(() => undefined);
  await assert.rejects(() => cleanupSpills(), /spill finalization failed/);
  await assert.rejects(() => access(path));
});

test("session shutdown gates new spill creation until the next session", () => {
  stopSpillSession();
  try {
    assert.throws(() => writeManagedSpill("late"), /disabled during session shutdown/);
  } finally {
    startSpillSession();
  }
});

test("formatCymbalOutput carries structured recovery metadata", async () => {
  const result = await formatCymbalOutput({
    result: {
      command: "cymbal show missing.ts",
      args: ["show", "missing.ts"],
      cwd: ".",
      stdout: "No Cymbal target resolved for `missing.ts`.\n",
      stderr: "",
      code: 1,
      status: "not_found",
      requestedTarget: "missing.ts",
      suggestions: ["src/missing.ts"],
      diagnostics: ["Error: no requested symbol or file resolved"],
    },
    format: "agent",
  });

  assert.equal(result.details.status, "not_found");
  assert.equal(result.details.requestedTarget, "missing.ts");
  assert.deepEqual(result.details.suggestions, ["src/missing.ts"]);
  assert.deepEqual(result.details.diagnostics, ["Error: no requested symbol or file resolved"]);
});
