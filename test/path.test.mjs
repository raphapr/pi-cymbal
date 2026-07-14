import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findRepoRoot, resolveMultiPathRun, resolvePathFilterRun, resolvePathOperand, suggestNearbyFiles } from "../src/tools/path.ts";

function fakeFs({ directories = [], files = [] }) {
  const dirSet = new Set(directories);
  const fileSet = new Set(files);
  return {
    stat(path) {
      return {
        isDirectory: () => dirSet.has(path),
        isFile: () => fileSet.has(path),
      };
    },
    exists(path) {
      return dirSet.has(path) || fileSet.has(path);
    },
    readdir(path, _options) {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const entries = [];
      const seen = new Set();
      const consider = (name, isDir, isFile) => {
        if (!name || seen.has(name)) return;
        seen.add(name);
        entries.push({ name, isFile: () => isFile, isDirectory: () => isDir });
      };
      for (const dir of dirSet) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes("/")) continue;
        consider(rest, true, false);
      }
      for (const file of fileSet) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        if (!rest || rest.includes("/")) continue;
        consider(rest, false, true);
      }
      return entries;
    },
  };
}

test("resolveMultiPathRun preserves mixed relative and absolute path meaning", async () => {
  const repo = await mkdtemp(join(tmpdir(), "pi-cymbal-path-"));
  await mkdir(join(repo, ".git"));
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src", "index.ts"), "", "utf8");
  await writeFile(join(repo, "src", "output.ts"), "", "utf8");
  try {
    const run = resolveMultiPathRun(
      { files: [] },
      repo,
      ["src/index.ts", join(repo, "src", "output.ts")],
      (params, files) => ({ ...params, files }),
      { classification: "always" },
    );
    assert.equal(run.cwd, repo);
    assert.deepEqual(run.params.files, ["src/index.ts", "src/output.ts"]);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("findRepoRoot canonicalizes symlinked repository roots", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "pi-cymbal-realpath-"));
  const repo = join(parent, "repo");
  const link = join(parent, "link");
  await mkdir(join(repo, ".git"), { recursive: true });
  try {
    try {
      await symlink(repo, link, "dir");
    } catch (error) {
      t.skip(`symlink unavailable: ${error.message}`);
      return;
    }
    assert.equal(findRepoRoot(link), repo);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("show file-symbol targets resolve from the original cwd", async () => {
  const repo = await mkdtemp(join(tmpdir(), "pi-cymbal-show-symbol-"));
  await mkdir(join(repo, ".git"));
  await mkdir(join(repo, "src"));
  try {
    assert.equal(
      resolvePathOperand("src/index.ts:runCymbal", repo, "show"),
      `${join(repo, "src", "index.ts")}:runCymbal`,
    );
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
});

test("exclude-only filters reject cross-repository ambiguity", async () => {
  const parent = await mkdtemp(join(tmpdir(), "pi-cymbal-excludes-"));
  const first = join(parent, "first");
  const second = join(parent, "second");
  await mkdir(join(first, ".git"), { recursive: true });
  await mkdir(join(second, ".git"), { recursive: true });
  try {
    assert.throws(
      () => resolvePathFilterRun(
        {},
        parent,
        {
          exclude: [join(first, "src", "**"), join(second, "src", "**")],
          applyPath: (params) => params,
          applyExclude: (params, exclude) => ({ ...params, exclude }),
        },
      ),
      /different repositories/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("unresolved globs through a symlink scope to the canonical repository", async (t) => {
  const parent = await mkdtemp(join(tmpdir(), "pi-cymbal-realpath-glob-"));
  const repo = join(parent, "repo");
  const link = join(parent, "link");
  await mkdir(join(repo, ".git"), { recursive: true });
  await mkdir(join(repo, "src"));
  try {
    try {
      await symlink(repo, link, "dir");
    } catch (error) {
      t.skip(`symlink unavailable: ${error.message}`);
      return;
    }
    const run = resolveMultiPathRun(
      { files: [] },
      parent,
      [join(link, "src", "**", "*.ts")],
      (params, files) => ({ ...params, files }),
      { classification: "always" },
    );
    assert.equal(run.cwd, repo);
    assert.deepEqual(run.params.files, [join("src", "**", "*.ts")]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("suggestNearbyFiles ranks short basename token matches above unrelated siblings", () => {
  const fs = fakeFs({
    directories: ["/repo", "/repo/a", "/repo/b", "/repo/c", "/repo/d", "/repo/src"],
    files: [
      "/repo/a/x.ts",
      "/repo/b/x.ts",
      "/repo/c/x.ts",
      "/repo/d/x.ts",
      "/repo/src/io_utils.ts",
    ],
  });

  const suggestions = suggestNearbyFiles("/repo", "io.ts", 3, fs);

  assert.ok(
    suggestions.includes("src/io_utils.ts"),
    `expected io_utils.ts in top suggestions, got ${JSON.stringify(suggestions)}`,
  );
});
