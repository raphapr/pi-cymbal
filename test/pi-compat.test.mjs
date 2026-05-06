import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("package loads through pi extension discovery", () => {
  const result = spawnSync("pi", ["-e", process.cwd(), "--list-models", "gpt-5.5"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(`${result.stdout}\n${result.stderr}`, /gpt-5\.5/);
});
