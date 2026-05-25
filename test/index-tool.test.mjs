import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerIndexTool } from "../src/tools/index.ts";

async function makeRepo(name) {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, ".git"));
  return dir;
}

function registerTool() {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };
  registerIndexTool(pi);
  return pi.tool;
}

test("cymbal_index checks availability and runs index", async () => {
  const calls = [];
  const tool = registerTool();

  const result = await tool.execute(
    "call-1",
    { force: true, workers: 2, exclude: "dist", includeGenerated: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options);
        if (options.args[0] === "index" && options.args[1] === "--help") {
          return { command: "cymbal index --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
        }
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: "indexed",
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls.map((call) => call.args), [["index", "--help"], ["index", "--force", "--workers", "2", "--exclude", "dist", "--include-generated"]]);
  assert.equal(result.content[0].text, "indexed");
});

test("cymbal_index scopes absolute paths to their repo root", async () => {
  const repo = await makeRepo("pi-cymbal-index-");
  await mkdir(join(repo, "src"), { recursive: true });
  const file = join(repo, "src", "index.ts");
  await writeFile(file, "export {};\n", "utf8");
  const calls = [];
  const tool = registerTool();

  try {
    await tool.execute(
      "call-1",
      { path: file, includeLargeFiles: true, format: "agent" },
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        runCymbal: async (options) => {
          calls.push(options);
          if (options.args[0] === "index" && options.args[1] === "--help") {
            return { command: "cymbal index --help", args: options.args, cwd: options.cwd, stdout: "usage", stderr: "", code: 0 };
          }
          return { command: `cymbal ${options.args.join(" ")}`, args: options.args, cwd: options.cwd, stdout: "indexed", stderr: "", code: 0 };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.equal(calls[1].cwd, repo);
    assert.deepEqual(calls[1].args, ["index", "src/index.ts", "--include-large-files"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_index reports unsupported command clearly", async () => {
  const tool = registerTool();

  await assert.rejects(
    () => tool.execute(
      "call-1",
      {},
      undefined,
      undefined,
      {
        cwd: process.cwd(),
        runCymbal: async () => { throw new Error("unknown command"); },
      },
    ),
    /does not support `cymbal index`/,
  );
});

test("cymbal_index advertises stale-index-only guidance", () => {
  const tool = registerTool();

  assert.match(tool.description, /Use only when index freshness is suspected or explicitly requested/);
  assert.match(tool.description, /cache-mutating but local-only/);
  assert.match(tool.promptSnippet, /Use only when index freshness is suspected or explicitly requested/);
  assert.ok(tool.promptGuidelines.some((guideline) => /Do not use cymbal_index for routine navigation/.test(guideline)));
});
