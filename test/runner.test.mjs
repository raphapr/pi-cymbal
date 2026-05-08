import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { runCymbal, runProcess } from "../src/cymbal.ts";

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

test("runProcess rejects before spawning when signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    () => runProcess({
      bin: process.execPath,
      args: ["-e", "process.stdout.write('ran');"],
      cwd: process.cwd(),
      signal: controller.signal,
    }),
    (error) => {
      assert.equal(error.result.stdout, "");
      assert.equal(error.result.code, 1);
      assert.match(error.message, /aborted/);
      return true;
    },
  );
});

test("runCymbal explains the Git repository requirement when Cymbal cannot detect a repo", async () => {
  const original = process.env.CYMBAL_BIN;
  const cwd = await mkdtemp(join(tmpdir(), "pi-cymbal-non-git-"));
  process.env.CYMBAL_BIN = process.execPath;

  try {
    await assert.rejects(
      () => runCymbal({
        args: [
          "-e",
          "process.stderr.write('Warning: not inside a git repository — results may be empty.\\nError: no repo detected — run cymbal index <path> or use --db');process.exit(1);",
        ],
        cwd,
      }),
      (error) => {
        assert.match(error.message, /pi-cymbal requires the current working directory to be inside a Git repository/);
        assert.match(error.message, new RegExp(`Current cwd: ${cwd.replaceAll("/", "\\/")}`));
        assert.match(error.message, /Use local file tools for non-Git directories/);
        assert.equal(error.result.code, 1);
        return true;
      },
    );
  } finally {
    if (original === undefined) delete process.env.CYMBAL_BIN;
    else process.env.CYMBAL_BIN = original;
    await rm(cwd, { recursive: true, force: true });
  }
});
