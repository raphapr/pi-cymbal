import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerMapTool } from "../src/tools/map.ts";

async function makeRepo(name) {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, ".git"));
  return dir;
}

test("cymbal_map runs against the repo selected by an absolute path", async () => {
  const currentRepo = await makeRepo("pi-cymbal-current-");
  const targetRepo = await makeRepo("pi-cymbal-target-");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerMapTool(pi);

    const result = await pi.tool.execute(
      "call-1",
      { path: targetRepo, stats: true, format: "agent" },
      undefined,
      undefined,
      {
        cwd: currentRepo,
        runCymbal: async (options) => {
          calls.push(options);
          return {
            command: `cymbal ${options.args.join(" ")}`,
            args: options.args,
            cwd: options.cwd,
            stdout: "target repo map",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].cwd, targetRepo);
    assert.deepEqual(calls[0].args, ["ls", ".", "--stats"]);
    assert.equal(result.content[0].text, "target repo map");
  } finally {
    await rm(currentRepo, { recursive: true, force: true });
    await rm(targetRepo, { recursive: true, force: true });
  }
});

test("cymbal_map scopes absolute subdirectories to their repo root", async () => {
  const targetRepo = await makeRepo("pi-cymbal-target-");
  const sourceDir = join(targetRepo, "src", "tools");
  await mkdir(sourceDir, { recursive: true });
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerMapTool(pi);

    await pi.tool.execute(
      "call-1",
      { path: sourceDir, depth: 2, stats: false },
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        runCymbal: async (options) => {
          calls.push(options);
          return {
            command: `cymbal ${options.args.join(" ")}`,
            args: options.args,
            cwd: options.cwd,
            stdout: "scoped map",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, targetRepo);
    assert.deepEqual(calls[0].args, ["ls", "src/tools", "--depth", "2"]);
  } finally {
    await rm(targetRepo, { recursive: true, force: true });
  }
});
