import assert from "node:assert/strict";
import test from "node:test";
import { runProcess } from "../src/cymbal.ts";

test("runProcess writes input to stdin", async () => {
  const result = await runProcess({
    bin: process.execPath,
    args: ["-e", "process.stdin.setEncoding('utf8');let data='';process.stdin.on('data', chunk => data += chunk);process.stdin.on('end', () => process.stdout.write(data.toUpperCase()));"],
    cwd: process.cwd(),
    input: "hello",
  });
  assert.equal(result.stdout, "HELLO");
  assert.equal(result.code, 0);
});

test("runProcess rejects non-zero exits with stdout and stderr", async () => {
  await assert.rejects(
    () => runProcess({
      bin: process.execPath,
      args: ["-e", "process.stdout.write('out');process.stderr.write('err');process.exit(7);"],
      cwd: process.cwd(),
    }),
    (error) => {
      assert.equal(error.result.stdout, "out");
      assert.equal(error.result.stderr, "err");
      assert.equal(error.result.code, 7);
      return true;
    },
  );
});

test("runProcess rejects promptly on timeout", async () => {
  const started = Date.now();
  await assert.rejects(
    () => runProcess({
      bin: process.execPath,
      args: ["-e", "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 200)); setInterval(() => {}, 1000);"],
      cwd: process.cwd(),
      timeoutMs: 50,
    }),
    (error) => {
      assert.equal(error.result.code, 124);
      assert.ok(Date.now() - started < 180, "timeout should reject before graceful process exit");
      return true;
    },
  );
});
