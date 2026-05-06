import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";

test("package loads through pi extension discovery", { skip: process.env.PI_COMPAT !== "1" }, () => {
  const output = execFileSync("pi", ["-e", process.cwd(), "--list-tools"], { cwd: process.cwd(), encoding: "utf8" });
  assert.match(output, /cymbal_map/);
});
