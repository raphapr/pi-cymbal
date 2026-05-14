import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerImportersTool } from "../src/tools/importers.ts";

async function makeRepo(name) {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, ".git"));
  return dir;
}

test("cymbal_importers scopes absolute file targets to their repo root", async () => {
  const repo = await makeRepo("pi-cymbal-importers-");
  await mkdir(join(repo, "src"), { recursive: true });
  const file = join(repo, "src", "index.ts");
  await writeFile(file, "export {};\n", "utf8");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerImportersTool(pi);

    const result = await pi.tool.execute(
      "call-1",
      { target: file, depth: 2, format: "agent" },
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
            stdout: "importers output",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.deepEqual(calls[0].args, ["importers", "src/index.ts", "--depth", "2"]);
    assert.equal(result.content[0].text, "importers output");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_importers preserves scoped package targets", async () => {
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerImportersTool(pi);

  await pi.tool.execute(
    "call-1",
    { target: "@earendil-works/pi-ai", format: "agent" },
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
          stdout: "package importers",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls[0].args, ["importers", "@earendil-works/pi-ai"]);
});
