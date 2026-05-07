import assert from "node:assert/strict";
import test from "node:test";
import { dirname } from "node:path";
import { ProcessError } from "../src/cymbal.ts";
import { noResultsSearchResult, resolveSearchRun } from "../src/tools/search.ts";

function fakeFs({ directories = [], files = [], repoRoots = [] }) {
  return {
    stat(path) {
      return { isDirectory: () => directories.includes(path), isFile: () => files.includes(path) };
    },
    exists(path) {
      return repoRoots.some((root) => path === `${root}/.git`);
    },
    dirname,
  };
}

test("resolveSearchRun treats a single absolute repo root path as the Cymbal cwd", () => {
  const run = resolveSearchRun(
    { query: "n8n_business", path: "/repo/ls-n8n", limit: 20 },
    "/repo/pi-cymbal",
    fakeFs({ directories: ["/repo/ls-n8n"], repoRoots: ["/repo/ls-n8n"] }),
  );

  assert.equal(run.cwd, "/repo/ls-n8n");
  assert.deepEqual(run.params, { query: "n8n_business", limit: 20 });
});

test("resolveSearchRun converts an absolute subdirectory filter to repo-relative", () => {
  const run = resolveSearchRun(
    { query: "registerSearchTool", path: "/repo/pi-cymbal/src" },
    "/repo/pi-cymbal",
    fakeFs({ directories: ["/repo/pi-cymbal/src", "/repo/pi-cymbal"], repoRoots: ["/repo/pi-cymbal"] }),
  );

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerSearchTool", path: "src" });
});

test("resolveSearchRun converts an absolute file filter to repo-relative", () => {
  const run = resolveSearchRun(
    { query: "registerSearchTool", path: "/repo/pi-cymbal/src/tools/search.ts" },
    "/repo/pi-cymbal",
    fakeFs({ files: ["/repo/pi-cymbal/src/tools/search.ts"], directories: ["/repo/pi-cymbal"], repoRoots: ["/repo/pi-cymbal"] }),
  );

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerSearchTool", path: "src/tools/search.ts" });
});

test("resolveSearchRun converts multiple absolute filters under one repo", () => {
  const run = resolveSearchRun(
    { query: "registerSearchTool", path: ["/repo/pi-cymbal/src", "/repo/pi-cymbal/test"] },
    "/repo/pi-cymbal",
    fakeFs({ directories: ["/repo/pi-cymbal/src", "/repo/pi-cymbal/test", "/repo/pi-cymbal"], repoRoots: ["/repo/pi-cymbal"] }),
  );

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerSearchTool", path: ["src", "test"] });
});

test("resolveSearchRun converts absolute exclude filters under the selected repo", () => {
  const run = resolveSearchRun(
    { query: "registerSearchTool", path: "/repo/pi-cymbal/src", exclude: "/repo/pi-cymbal/src/generated" },
    "/repo/other",
    fakeFs({ directories: ["/repo/pi-cymbal/src", "/repo/pi-cymbal/src/generated", "/repo/pi-cymbal"], repoRoots: ["/repo/pi-cymbal"] }),
  );

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerSearchTool", path: "src", exclude: "src/generated" });
});

test("resolveSearchRun uses an absolute exclude to select the repo when path is relative", () => {
  const run = resolveSearchRun(
    { query: "registerSearchTool", path: "src", exclude: "/repo/pi-cymbal/test" },
    "/repo/other",
    fakeFs({ directories: ["/repo/pi-cymbal/test", "/repo/pi-cymbal"], repoRoots: ["/repo/pi-cymbal"] }),
  );

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerSearchTool", path: "src", exclude: "test" });
});

test("resolveSearchRun keeps relative paths as Cymbal path filters", () => {
  const run = resolveSearchRun({ query: "registerCymbalHooks", path: "src" }, "/repo/pi-cymbal");

  assert.equal(run.cwd, "/repo/pi-cymbal");
  assert.deepEqual(run.params, { query: "registerCymbalHooks", path: "src" });
});

test("noResultsSearchResult converts Cymbal no-result exits into visible output", () => {
  const error = new ProcessError("cymbal search missing failed (exit 1)", {
    command: "cymbal search missing",
    args: ["search", "missing"],
    cwd: "/repo/pi-cymbal",
    stdout: "",
    stderr: "Error: no results found for 'missing'\n",
    code: 1,
  });

  const result = noResultsSearchResult(error);

  assert.equal(result?.stdout, "Error: no results found for 'missing'\n");
  assert.equal(result?.stderr, "");
  assert.equal(result?.code, 1);
});

test("noResultsSearchResult returns JSON output for JSON callers", () => {
  const error = new ProcessError("cymbal search missing --json failed (exit 1)", {
    command: "cymbal search missing --json",
    args: ["search", "missing", "--json"],
    cwd: "/repo/pi-cymbal",
    stdout: "",
    stderr: "Error: no results found for 'missing'\n",
    code: 1,
  });

  const result = noResultsSearchResult(error, "json");

  assert.deepEqual(JSON.parse(result?.stdout ?? ""), { results: [] });
  assert.equal(result?.stderr, "");
});
