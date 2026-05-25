import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerOutlineTool } from "../src/tools/outline.ts";

test("cymbal_outline runs one Cymbal command per file and combines output with names", async () => {
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerOutlineTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { files: ["@src/cymbal.ts", "src/tools/common.ts"], names: true, signatures: true, format: "agent" },
    undefined,
    undefined,
    {
      cwd: ".",
      runCymbal: async (options) => {
        calls.push(options.args);
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: `outline for ${options.args[1]}`,
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls, [
    ["outline", "src/cymbal.ts", "--names", "--signatures"],
    ["outline", "src/tools/common.ts", "--names", "--signatures"],
  ]);
  assert.match(result.content[0].text, /outline for src\/cymbal\.ts/);
  assert.match(result.content[0].text, /outline for src\/tools\/common\.ts/);
  assert.equal(result.details.commands.length, 2);
});

test("cymbal_outline reports no_repo before empty outline", async () => {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerOutlineTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { files: ["/etc/hosts"], format: "json" },
    undefined,
    undefined,
    {
      cwd: "/tmp",
      runCymbal: async (options) => ({
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: "",
        stderr: "Warning: not inside a git repository — results may be empty.\nRun 'cymbal index <path>' to index a specific directory.\nNo symbols found. Is the file indexed? Run 'cymbal index /etc'\n",
        code: 0,
      }),
    },
  );

  assert.equal(result.details.status, "no_repo");
  assert.equal(JSON.parse(result.content[0].text).status, "no_repo");
});

test("cymbal_outline keeps successful files when another file is not found", async () => {
  const repo = await mkdtemp(join(tmpdir(), "pi-cymbal-outline-"));
  await mkdir(join(repo, ".git"));
  await mkdir(join(repo, "src"), { recursive: true });
  await writeFile(join(repo, "src", "access_policy.sql.go"), "package sqlc\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerOutlineTool(pi);

    const result = await pi.tool.execute(
      "call-1",
      { files: ["src/index.ts", "src/queries/access_policy.sql"], names: true, format: "agent" },
      undefined,
      undefined,
      {
        cwd: repo,
        runCymbal: async (options) => {
          if (options.args[1] === "src/queries/access_policy.sql") {
            return {
              command: `cymbal ${options.args.join(" ")}`,
              args: options.args,
              cwd: options.cwd,
              stdout: "",
              stderr: "No symbols found. Is the file indexed? Run 'cymbal index /tmp/repo'\n",
              code: 0,
            };
          }
          return {
            command: `cymbal ${options.args.join(" ")}`,
            args: options.args,
            cwd: options.cwd,
            stdout: "outline for index",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.match(result.content[0].text, /## src\/index\.ts/);
    assert.match(result.content[0].text, /outline for index/);
    assert.match(result.content[0].text, /## src\/queries\/access_policy\.sql/);
    assert.match(result.content[0].text, /No Cymbal outline symbols resolved/);
    assert.match(result.content[0].text, /No symbols found/);
    assert.equal(result.details.status, "partial");
    assert.equal(result.details.results[1].status, "empty");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
