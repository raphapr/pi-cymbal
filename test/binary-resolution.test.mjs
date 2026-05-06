import assert from "node:assert/strict";
import test from "node:test";
import { buildCymbalEnv, normalizePathArg, resolveCymbalBinary } from "../src/cymbal.ts";

test("resolveCymbalBinary prefers CYMBAL_BIN", () => {
  const result = resolveCymbalBinary({ env: { CYMBAL_BIN: "/custom/cymbal" }, home: "/home/test", exists: () => false });
  assert.equal(result, "/custom/cymbal");
});

test("resolveCymbalBinary uses ~/.local/bin/cymbal when present", () => {
  const result = resolveCymbalBinary({ env: {}, home: "/home/test", exists: (path) => path === "/home/test/.local/bin/cymbal" });
  assert.equal(result, "/home/test/.local/bin/cymbal");
});

test("resolveCymbalBinary falls back to PATH lookup", () => {
  const result = resolveCymbalBinary({ env: {}, home: "/home/test", exists: () => false });
  assert.equal(result, "cymbal");
});

test("normalizePathArg strips leading @", () => {
  assert.equal(normalizePathArg("@src/index.ts"), "src/index.ts");
});

test("buildCymbalEnv disables noisy output", () => {
  const env = buildCymbalEnv({ FOO: "bar" });
  assert.equal(env.FOO, "bar");
  assert.equal(env.CYMBAL_NO_UPDATE_NOTIFIER, "1");
  assert.equal(env.NO_COLOR, "1");
  assert.equal(env.TERM, "dumb");
});
