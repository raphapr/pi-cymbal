import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CymbalError, ProcessError } from "../src/cymbal.ts";
import { registerShowTool } from "../src/tools/show.ts";

async function makeRepo(name) {
  const dir = await mkdtemp(join(tmpdir(), name));
  await mkdir(join(dir, ".git"));
  return dir;
}

function missingTargetError(target, cwd = process.cwd()) {
  return new ProcessError(`cymbal show ${target} failed (exit 1)`, {
    command: `cymbal show ${target}`,
    args: ["show", target],
    cwd,
    stdout: `${target}: file not found: ${target}\n`,
    stderr: "Error: no requested symbol or file resolved\n",
    code: 1,
  });
}

function outsideRepoError(target, cwd = process.cwd()) {
  return new CymbalError(`${target}: refusing to read file outside repository: ${target}`, {
    command: `cymbal show ${target}`,
    args: ["show", target, "--json"],
    cwd,
    stdout: "",
    stderr: `${target}: refusing to read file outside repository: ${target}\nError: no requested symbol or file resolved\n`,
    code: 1,
  });
}

test("cymbal_show supports multiple targets with partial not-found recovery", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
  await mkdir(join(repo, "src"), { recursive: true });
  await writeFile(join(repo, "src", "access_policy.sql.go"), "package sqlc\n", "utf8");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    const result = await pi.tool.execute(
      "call-1",
      { targets: ["src/index.ts", "src/queries/access_policy.sql"], context: 2, format: "agent" },
      undefined,
      undefined,
      {
        cwd: repo,
        runCymbal: async (options) => {
          calls.push(options.args);
          if (options.args[1] === "src/queries/access_policy.sql") throw missingTargetError(options.args[1], options.cwd);
          return {
            command: `cymbal ${options.args.join(" ")}`,
            args: options.args,
            cwd: options.cwd,
            stdout: "source for index",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls.length, 2);
    assert.match(result.content[0].text, /## src\/index\.ts/);
    assert.match(result.content[0].text, /source for index/);
    assert.match(result.content[0].text, /## src\/queries\/access_policy\.sql/);
    assert.match(result.content[0].text, /No Cymbal target resolved/);
    assert.match(result.content[0].text, /src\/access_policy\.sql\.go/);
    assert.equal(result.details.status, "partial");
    assert.equal(result.details.results[0].status, "ok");
    assert.equal(result.details.results[1].status, "not_found");
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_show returns valid JSON for multiple targets", async () => {
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerShowTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { targets: ["src/params.ts", "definitely_missing_file_zzzz.ts"], format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => {
        calls.push(options.args);
        return {
          command: `cymbal ${options.args.join(" ")}`,
          args: options.args,
          cwd: options.cwd,
          stdout: JSON.stringify({
            results: {
              "src/params.ts": { file: "src/params.ts" },
              "definitely_missing_file_zzzz.ts": { error: "file not found: definitely_missing_file_zzzz.ts" },
            },
            version: "0.1",
          }),
          stderr: "",
          code: 0,
        };
      },
    },
  );

  assert.deepEqual(calls, [["show", "src/params.ts", "definitely_missing_file_zzzz.ts", "--json"]]);
  const results = JSON.parse(result.content[0].text).results;
  assert.ok(results["src/params.ts"]);
  assert.ok(results["definitely_missing_file_zzzz.ts"]);
  assert.equal(result.details.status, "partial");
});

test("cymbal_show reports not_found when JSON multi-target results are all errors", async () => {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerShowTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { targets: ["missing1.ts", "missing2.ts"], format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async (options) => ({
        command: `cymbal ${options.args.join(" ")}`,
        args: options.args,
        cwd: options.cwd,
        stdout: JSON.stringify({
          results: {
            "missing1.ts": { error: "file not found: missing1.ts" },
            "missing2.ts": { error: "file not found: missing2.ts" },
          },
          version: "0.1",
        }),
        stderr: "",
        code: 0,
      }),
    },
  );

  assert.equal(result.details.status, "not_found");
});

test("cymbal_show returns JSON when recovering a missing JSON target", async () => {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerShowTool(pi);

  const result = await pi.tool.execute(
    "call-1",
    { target: "missing1.ts", format: "json" },
    undefined,
    undefined,
    {
      cwd: process.cwd(),
      runCymbal: async () => {
        throw missingTargetError("missing1.ts");
      },
    },
  );

  assert.equal(result.details.status, "not_found");
  assert.deepEqual(JSON.parse(result.content[0].text).status, "not_found");
});

test("cymbal_show allows same-repo absolute and relative JSON targets", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
  await mkdir(join(repo, "src"), { recursive: true });
  const file = join(repo, "src", "index.ts");
  await writeFile(file, "export {};\n", "utf8");
  await writeFile(join(repo, "README.md"), "# test\n", "utf8");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await pi.tool.execute(
      "call-1",
      { targets: [`${file}:1-1`, "README.md:1-1"], format: "json" },
      undefined,
      undefined,
      {
        cwd: repo,
        runCymbal: async (options) => {
          calls.push(options);
          return {
            command: `cymbal ${options.args.join(" ")}`,
            args: options.args,
            cwd: options.cwd,
            stdout: JSON.stringify({ results: { [`${file}:1-1`]: { file }, "README.md:1-1": { file: "README.md" } } }),
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.deepEqual(calls[0].args, ["show", "src/index.ts:1-1", "README.md:1-1", "--json"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_show rejects mixed-scope JSON targets", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
  await mkdir(join(repo, "src"), { recursive: true });
  const file = join(repo, "src", "index.ts");
  await writeFile(file, "export {};\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await assert.rejects(
      () =>
        pi.tool.execute(
          "call-1",
          { targets: [`${file}:1-1`, "README.md:1-1"], format: "json" },
          undefined,
          undefined,
          {
            cwd: process.cwd(),
            runCymbal: async () => {
              throw new Error("runCymbal should not be called for mixed-scope JSON targets");
            },
          },
        ),
      /mixed-scope JSON targets/,
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_show rejects a single-element no-repo absolute JSON targets array", async () => {
  const outside = await mkdtemp(join(tmpdir(), "pi-cymbal-norepo-"));
  await writeFile(join(outside, "stray.ts"), "export {};\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await assert.rejects(
      () =>
        pi.tool.execute(
          "call-1",
          { targets: [`${join(outside, "stray.ts")}:1-1`], format: "json" },
          undefined,
          undefined,
          {
            cwd: process.cwd(),
            runCymbal: async () => {
              throw new Error("runCymbal must not be invoked when validation rejects the batch");
            },
          },
        ),
      /cross-repo or no-repo JSON targets/,
    );
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
});

test("cymbal_show rejects no-repo absolute JSON targets", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
  const outside = await mkdtemp(join(tmpdir(), "pi-cymbal-norepo-"));
  await mkdir(join(repo, "src"), { recursive: true });
  await writeFile(join(repo, "src", "index.ts"), "export {};\n", "utf8");
  await writeFile(join(outside, "stray.ts"), "export {};\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await assert.rejects(
      () =>
        pi.tool.execute(
          "call-1",
          { targets: [`${join(outside, "stray.ts")}:1-1`, "src/index.ts:1-1"], format: "json" },
          undefined,
          undefined,
          {
            cwd: repo,
            runCymbal: async () => {
              throw new Error("runCymbal must not be invoked when validation rejects the batch");
            },
          },
        ),
      /cross-repo or no-repo JSON targets/,
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("cymbal_show rejects cross-repo absolute JSON targets", async () => {
  const firstRepo = await makeRepo("pi-cymbal-show-first-");
  const secondRepo = await makeRepo("pi-cymbal-show-second-");
  await mkdir(join(firstRepo, "src"), { recursive: true });
  await mkdir(join(secondRepo, "src"), { recursive: true });
  const firstFile = join(firstRepo, "src", "index.ts");
  const secondFile = join(secondRepo, "src", "index.ts");
  await writeFile(firstFile, "export {};\n", "utf8");
  await writeFile(secondFile, "export {};\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await assert.rejects(
      () =>
        pi.tool.execute(
          "call-1",
          { targets: [`${firstFile}:1-1`, `${secondFile}:1-1`], format: "json" },
          undefined,
          undefined,
          {
            cwd: firstRepo,
            runCymbal: async () => {
              throw new Error("runCymbal should not be called for cross-repo JSON targets");
            },
          },
        ),
      /cross-repo or no-repo JSON targets/,
    );
  } finally {
    await rm(firstRepo, { recursive: true, force: true });
    await rm(secondRepo, { recursive: true, force: true });
  }
});

test("cymbal_show preserves outside-repository errors", async () => {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerShowTool(pi);

  await assert.rejects(
    () =>
      pi.tool.execute(
        "call-1",
        { target: "/etc/hosts", format: "json" },
        undefined,
        undefined,
        {
          cwd: process.cwd(),
          runCymbal: async () => {
            throw outsideRepoError("/etc/hosts");
          },
        },
      ),
    /outside repository/,
  );
});

test("cymbal_show preserves no-repo errors", async () => {
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  registerShowTool(pi);

  await assert.rejects(
    () =>
      pi.tool.execute(
        "call-1",
        { target: "missing.ts", format: "agent" },
        undefined,
        undefined,
        {
          cwd: "/tmp",
          runCymbal: async () => {
            throw new CymbalError("pi-cymbal requires a Git repository", {
              command: "cymbal show missing.ts",
              args: ["show", "missing.ts"],
              cwd: "/tmp",
              stdout: "missing.ts: file not found: missing.ts\n",
              stderr: "Warning: not inside a git repository — results may be empty.\nError: no requested symbol or file resolved\n",
              code: 1,
            });
          },
        },
      ),
    /Git repository/,
  );
});

test("cymbal_show scopes absolute include and exclude filters", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
  await mkdir(join(repo, "src"), { recursive: true });
  await mkdir(join(repo, "test"), { recursive: true });
  await writeFile(join(repo, "src", "index.ts"), "export {};\n", "utf8");
  const calls = [];
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await pi.tool.execute(
      "call-1",
      { target: "registerShowTool", path: join(repo, "src"), exclude: join(repo, "test"), all: true, format: "agent" },
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
            stdout: "filtered symbol source",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.deepEqual(calls[0].args, ["show", "registerShowTool", "--all", "--path", "src", "--exclude", "test"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("cymbal_show rejects include filters that conflict with an absolute target repo", async () => {
  const targetRepo = await makeRepo("pi-cymbal-show-target-");
  const filterRepo = await makeRepo("pi-cymbal-show-filter-");
  await mkdir(join(targetRepo, "src"), { recursive: true });
  await mkdir(join(filterRepo, "src"), { recursive: true });
  const file = join(targetRepo, "src", "index.ts");
  await writeFile(file, "export {};\n", "utf8");
  const pi = {
    registerTool(tool) {
      this.tool = tool;
    },
  };

  try {
    registerShowTool(pi);

    await assert.rejects(
      () =>
        pi.tool.execute(
          "call-1",
          { target: `${file}:1-1`, path: join(filterRepo, "src"), format: "agent" },
          undefined,
          undefined,
          {
            cwd: process.cwd(),
            runCymbal: async () => {
              throw new Error("runCymbal should not be called for conflicting filter scope");
            },
          },
        ),
      /different repository than the target/,
    );
  } finally {
    await rm(targetRepo, { recursive: true, force: true });
    await rm(filterRepo, { recursive: true, force: true });
  }
});

test("cymbal_show scopes an absolute file target to its repository", async () => {
  const repo = await makeRepo("pi-cymbal-show-");
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
    registerShowTool(pi);

    await pi.tool.execute(
      "call-1",
      { target: `${file}:1-1`, format: "agent" },
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
            stdout: "absolute file source",
            stderr: "",
            code: 0,
          };
        },
      },
    );

    assert.equal(calls[0].cwd, repo);
    assert.deepEqual(calls[0].args, ["show", "src/index.ts:1-1"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});
