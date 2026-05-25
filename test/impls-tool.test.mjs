import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerImplsTool } from "../src/tools/impls.ts";

async function makeRepo(name) {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, ".git"));
  return dir;
}

test("cymbal_impls scopes absolute include and exclude filters", async () => {
  const repo = await makeRepo("pi-cymbal-impls-");
  await mkdir(join(repo, "src"), { recursive: true });
  await mkdir(join(repo, "test"), { recursive: true });
  await writeFile(join(repo, "src", "index.ts"), "export {}\n", "utf8");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerImplsTool(pi);

    await pi.tool.execute(
      "call-1",
      { symbol: "Reader", symbols: ["Writer"], lang: "typescript", path: join(repo, "src"), exclude: join(repo, "test"), resolved: true, format: "agent" },
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
            stdout: "impls output",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.deepEqual(calls[0].args, ["impls", "Reader", "Writer", "--lang", "typescript", "--path", "src", "--exclude", "test", "--resolved"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
