import assert from "node:assert/strict";
import test from "node:test";
import { suggestNearbyFiles } from "../src/tools/path.ts";

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
