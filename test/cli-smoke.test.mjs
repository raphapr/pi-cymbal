import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cymbal = process.env.CYMBAL_BIN ?? "cymbal";
const available = spawnSync(cymbal, ["version"], { encoding: "utf8" }).status === 0;

test("cymbal cli smoke", { skip: !available }, () => {
  const result = spawnSync(cymbal, ["ls", ".", "--stats"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
