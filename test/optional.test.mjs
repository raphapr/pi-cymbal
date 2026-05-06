import assert from "node:assert/strict";
import test from "node:test";
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
