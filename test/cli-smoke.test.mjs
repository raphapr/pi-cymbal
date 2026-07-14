import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  buildChangedArgs,
  buildContextArgs,
  buildDiffArgs,
  buildImpactArgs,
  buildImplsArgs,
  buildImportersArgs,
  buildIndexArgs,
  buildInvestigateArgs,
  buildMapArgs,
  buildOutlineArgs,
  buildRefsArgs,
  buildSearchArgs,
  buildShowArgs,
  buildStructureArgs,
  buildTraceArgs,
} from "../src/params.ts";

const cymbal = process.env.CYMBAL_BIN ?? "cymbal";
const required = process.env.REQUIRE_CYMBAL === "1";
const version = spawnSync(cymbal, ["version"], { encoding: "utf8" });
const available = version.status === 0;
const exactVersion = available && version.stdout.split(/\r?\n/, 1)[0] === "cymbal v0.14.0";

if (required && !exactVersion) {
  throw new Error(`REQUIRE_CYMBAL=1 but ${cymbal} is not Cymbal v0.14.0: ${version.error?.message ?? version.stdout ?? version.stderr}`);
}

function run(args, options = {}) {
  return spawnSync(cymbal, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function containsSymbol(value, name, relPath) {
  if (!value || typeof value !== "object") return false;
  if (value.name === name && (value.rel_path === relPath || String(value.file ?? "").endsWith(`/${relPath}`))) return true;
  return Object.values(value).some((entry) => containsSymbol(entry, name, relPath));
}

test("pinned Cymbal version is v0.14.0", { skip: !exactVersion }, () => {
  assert.equal(version.stdout.split(/\r?\n/, 1)[0], "cymbal v0.14.0");
});

test("every registered Cymbal command exposes help", { skip: !exactVersion }, () => {
  const commands = [
    "ls", "structure", "diff", "index", "search", "outline", "show", "refs",
    "impact", "importers", "impls", "changed", "investigate", "trace", "context", "hook",
  ];
  for (const command of commands) assertSuccess(run([command, "--help"]));
});

test("real Cymbal accepts representative adapter arguments", { skip: !exactVersion }, () => {
  const commands = [
    buildMapArgs({ path: ".", stats: true }),
    buildStructureArgs({ format: "json" }),
    buildDiffArgs({ symbol: "runCymbal", stat: true, format: "json" }),
    buildIndexArgs({ path: ".", workers: 1, format: "json" }),
    buildOutlineArgs({ files: ["src/index.ts"], signatures: true, format: "json" }),
    buildShowArgs({ targets: ["src/index.ts:1-3", "runCymbal", "src/cymbal.ts:runCymbal"], format: "json" }),
    buildRefsArgs({ symbol: "runCymbal", limit: 5, format: "json" }),
    buildImportersArgs({ target: "src/cymbal.ts", limit: 5, format: "json" }),
    buildImplsArgs({ symbol: "ProcessError", limit: 5, format: "json" }),
    buildChangedArgs({ format: "json" }),
    buildInvestigateArgs({ symbol: "runCymbal", format: "json" }),
    buildTraceArgs({ symbol: "runCymbal", depth: 1, limit: 5, format: "json" }),
    buildContextArgs({ symbol: "runCymbal", callers: 2, format: "json" }),
  ];
  for (const args of commands) assertSuccess(run(args));
});

test("real symbol search finds runCymbal in src/cymbal.ts", { skip: !exactVersion }, () => {
  const result = run(buildSearchArgs({ query: "runCymbal", exact: true, limit: 5, format: "json" }));
  assertSuccess(result);
  assert.equal(containsSymbol(JSON.parse(result.stdout), "runCymbal", "src/cymbal.ts"), true, result.stdout);
});

test("real graph output follows the deterministic JSON contract", { skip: !exactVersion }, () => {
  const result = run(buildImpactArgs({ symbol: "runCymbal", graph: true }));
  assertSuccess(result);
  assert.doesNotThrow(() => JSON.parse(result.stdout));
});

test("leading-dash operands and flag values do not trigger Cymbal options", { skip: !exactVersion }, () => {
  const commands = [
    [buildShowArgs({ target: "--json" }), 1, /--json/],
    [buildDiffArgs({ symbol: "--help" }), 1, /--help/],
    [buildSearchArgs({ query: "--help", text: true }), 0, /query: "--help"/],
    [buildChangedArgs({ base: "--help" }), 1, /invalid base ref "--help"/],
    [buildImplsArgs({ of: "--help", format: "json" }), 0, /--help/],
  ];
  for (const [args, expectedStatus, expected] of commands) {
    const result = run(args);
    const output = `${result.stdout}\n${result.stderr}`;
    assert.equal(result.status, expectedStatus, output);
    assert.doesNotMatch(output, /^Usage:|unknown (?:flag|shorthand)|flag provided but not defined|strconv\.ParseBool/im);
    assert.match(output, expected);
  }
});

test("cymbal search accepts quoted hyphenated symbol queries", { skip: !exactVersion }, () => {
  const result = run(["search", "--limit", "20", "--path", "src", "--", "registerCymbalHooks", "\"include-arguments\""]);
  assertSuccess(result);
  assert.doesNotMatch(result.stderr, /no such column/);
});
