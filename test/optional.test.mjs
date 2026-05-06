import assert from "node:assert/strict";
import test from "node:test";
import { CymbalError } from "../src/cymbal.ts";
import { ensureCommandAvailable } from "../src/tools/optional.ts";

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
