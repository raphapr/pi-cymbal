import { mkdtemp, readFile, rm } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { abortCymbalSession, runCymbal, runProcess, startCymbalSession, waitForCymbalOperations } from "../src/cymbal.ts";
import { cleanupSpills } from "../src/spill.ts";

async function waitUntil(check, message, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(10);
  }
  assert.fail(message);
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

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

test("runProcess preserves timeout precedence over a later caller abort", async () => {
  const started = Date.now();
  const controller = new AbortController();
  const lateAbort = setTimeout(() => controller.abort(new DOMException("late abort", "AbortError")), 75);
  try {
    await assert.rejects(
      () => runProcess({
        bin: process.execPath,
        args: ["-e", "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 200)); setInterval(() => {}, 1000);"],
        cwd: process.cwd(),
        signal: controller.signal,
        timeoutMs: 50,
      }),
      (error) => {
        assert.equal(error.name, "ProcessTimeoutError");
        assert.equal(error.result.code, 124);
        assert.ok(Date.now() - started < 750, "timeout should finish bounded tree termination");
        return true;
      },
    );
  } finally {
    clearTimeout(lateAbort);
  }
});

test("runProcess rejects before spawning with the caller abort reason", async () => {
  const controller = new AbortController();
  const reason = new DOMException("stop before spawn", "AbortError");
  controller.abort(reason);

  await assert.rejects(
    () => runProcess({
      bin: process.execPath,
      args: ["-e", "process.stdout.write('ran');"],
      cwd: process.cwd(),
      signal: controller.signal,
    }),
    (error) => error === reason,
  );
});

test("runProcess ignores stdin EPIPE after an early child exit", async () => {
  await assert.doesNotReject(() => runProcess({
    bin: process.execPath,
    args: ["-e", "process.exit(0)"],
    cwd: process.cwd(),
    input: "x".repeat(128 * 1024),
  }));
});

test("runProcess bounds raw UTF-8 capture and spills the complete stream", async () => {
  const result = await runProcess({
    bin: process.execPath,
    args: ["-e", "const b=Buffer.from('A😀B');process.stdout.write(b.subarray(0,3));process.stdout.write(b.subarray(3));"],
    cwd: process.cwd(),
    captureMaxBytes: 4,
  });

  assert.ok(Buffer.byteLength(result.stdout) <= 4);
  assert.equal(result.stdoutTruncated, true);
  assert.ok(result.stdoutPath);
  assert.equal(await readFile(result.stdoutPath, "utf8"), "A😀B");
});

test("runProcess classifies an invalid cwd before spawning", async () => {
  await assert.rejects(
    () => runProcess({ bin: process.execPath, args: ["-e", ""], cwd: "/definitely/missing/pi-cymbal-cwd" }),
    (error) => error?.name === "ProcessCwdError",
  );
});

test("synchronous spawn failures release capture finalizers", async () => {
  await assert.rejects(
    () => runProcess({ bin: process.execPath, args: ["\0"], cwd: process.cwd() }),
    /null bytes|must be a string without null bytes/i,
  );
  await Promise.race([
    cleanupSpills(),
    sleep(500).then(() => assert.fail("spill cleanup hung after synchronous spawn failure")),
  ]);
});

test("runProcess preserves the caller abort reason", async () => {
  const controller = new AbortController();
  const reason = new DOMException("stop", "AbortError");
  const promise = runProcess({
    bin: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
    signal: controller.signal,
  });
  controller.abort(reason);
  await assert.rejects(() => promise, (error) => error === reason);
});

test("runProcess abort reaps the child process group", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-cymbal-tree-"));
  const ready = join(directory, "ready.json");
  const script = [
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
    `fs.writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ parent: process.pid, descendant: descendant.pid }));`,
    "setInterval(() => {}, 1000);",
  ].join("");
  const controller = new AbortController();
  const reason = new DOMException("stop tree", "AbortError");
  const promise = runProcess({
    bin: process.execPath,
    args: ["-e", script],
    cwd: directory,
    signal: controller.signal,
    terminationGraceMs: 20,
  });

  try {
    await waitUntil(async () => {
      try { await readFile(ready); return true; } catch { return false; }
    }, "child process did not report readiness");
    const pids = JSON.parse(await readFile(ready, "utf8"));
    controller.abort(reason);
    await assert.rejects(() => promise, (error) => error === reason);
    await waitUntil(
      () => !processAlive(pids.parent) && !processAlive(pids.descendant),
      `process group remained alive: ${JSON.stringify(pids)}`,
    );
  } finally {
    if (!controller.signal.aborted) controller.abort(reason);
    await promise.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("runProcess capture failure wins late abort and reaps descendants", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-cymbal-capture-tree-"));
  const ready = join(directory, "ready.json");
  const script = [
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
    `fs.writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ parent: process.pid, descendant: descendant.pid }));`,
    "process.stdout.write('overflow');setInterval(() => {}, 1000);",
  ].join("");
  const controller = new AbortController();
  const lateReason = new DOMException("late abort", "AbortError");
  let opened = false;
  const promise = runProcess({
    bin: process.execPath,
    args: ["-e", script],
    cwd: directory,
    signal: controller.signal,
    captureMaxBytes: 1,
    terminationGraceMs: 20,
    captureFs: {
      open() {
        opened = true;
        queueMicrotask(() => controller.abort(lateReason));
        throw new Error("capture open failed");
      },
      write() { throw new Error("unexpected write"); },
      close() {},
    },
  });

  try {
    await waitUntil(async () => {
      try { await readFile(ready); return true; } catch { return false; }
    }, "capture-failure child did not report readiness");
    const pids = JSON.parse(await readFile(ready, "utf8"));
    await assert.rejects(
      () => promise,
      (error) => {
        assert.equal(opened, true);
        assert.equal(error.name, "ProcessCaptureError");
        assert.match(error.cause.message, /capture open failed/);
        return true;
      },
    );
    await waitUntil(
      () => !processAlive(pids.parent) && !processAlive(pids.descendant),
      `capture-failure process group remained alive: ${JSON.stringify(pids)}`,
    );
  } finally {
    if (!controller.signal.aborted) controller.abort(lateReason);
    await promise.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("runProcess capture close failure reaps descendants", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "pi-cymbal-close-tree-"));
  const ready = join(directory, "ready.json");
  const script = [
    "const { spawn } = require('node:child_process');",
    "const fs = require('node:fs');",
    "const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });",
    `fs.writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ parent: process.pid, descendant: descendant.pid }));`,
    "process.stdout.end('overflow');setInterval(() => {}, 1000);",
  ].join("");
  const controller = new AbortController();
  const reason = new DOMException("cleanup", "AbortError");
  const promise = runProcess({
    bin: process.execPath,
    args: ["-e", script],
    cwd: directory,
    signal: controller.signal,
    captureMaxBytes: 1,
    terminationGraceMs: 20,
    captureFs: {
      open() { return 1; },
      write(_fd, buffer) { return buffer.byteLength; },
      close() { throw new Error("capture close failed"); },
    },
  });

  try {
    await waitUntil(async () => {
      try { await readFile(ready); return true; } catch { return false; }
    }, "capture-close child did not report readiness");
    const pids = JSON.parse(await readFile(ready, "utf8"));
    await assert.rejects(
      () => promise,
      (error) => error?.name === "ProcessCaptureError" && /capture close failed/.test(error.cause?.message),
    );
    await waitUntil(
      () => !processAlive(pids.parent) && !processAlive(pids.descendant),
      `capture-close process group remained alive: ${JSON.stringify(pids)}`,
    );
  } finally {
    if (!controller.signal.aborted) controller.abort(reason);
    await promise.catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("session cancellation aborts and awaits an active non-hook Cymbal operation", async () => {
  const original = process.env.CYMBAL_BIN;
  process.env.CYMBAL_BIN = process.execPath;
  startCymbalSession();
  const reason = new DOMException("session shutdown", "AbortError");
  const promise = runCymbal({
    args: ["-e", "setInterval(() => {}, 1000)"],
    cwd: process.cwd(),
  });
  abortCymbalSession(reason);
  try {
    await assert.rejects(() => promise, (error) => error === reason);
    await assert.doesNotReject(() => waitForCymbalOperations());
  } finally {
    startCymbalSession();
    if (original === undefined) delete process.env.CYMBAL_BIN;
    else process.env.CYMBAL_BIN = original;
  }
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
