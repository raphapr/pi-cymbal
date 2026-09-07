import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildNudgePayload, parseNudgeResponse } from "../src/hooks.ts";
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
const exactVersion = available && version.stdout.split(/\r?\n/, 1)[0] === "cymbal v0.15.0";

if (required && !exactVersion) {
  throw new Error(`REQUIRE_CYMBAL=1 but ${cymbal} is not Cymbal v0.15.0: ${version.error?.message ?? version.stdout ?? version.stderr}`);
}

function run(args, options = {}) {
  return spawnSync(cymbal, args, {
    cwd: process.cwd(),
    env: { ...process.env, CYMBAL_NO_UPDATE_NOTIFIER: "1" },
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

test("pinned Cymbal version is v0.15.0", { skip: !exactVersion }, () => {
  assert.equal(version.stdout.split(/\r?\n/, 1)[0], "cymbal v0.15.0");
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
    buildMapArgs({ names: true, pattern: "**/*.ts", lang: "typescript", format: "json" }),
    buildImpactArgs({ symbol: "runCymbal", testPath: ["qa/", "**/*_it.go"], noTests: true, graph: true }),
    buildStructureArgs({ format: "json" }),
    buildDiffArgs({ symbol: "runCymbal", stat: true, format: "json" }),
    buildIndexArgs({ path: ".", workers: 1, format: "json" }),
    buildOutlineArgs({ files: ["src/index.ts"], signatures: true, format: "json" }),
    buildShowArgs({ targets: ["src/index.ts:1-3", "runCymbal", "src/cymbal.ts:runCymbal"], format: "json" }),
    buildRefsArgs({ symbol: "runCymbal", limit: 5, format: "json" }),
    buildImportersArgs({ target: "src/cymbal.ts", limit: 5, format: "json" }),
    buildImplsArgs({ symbol: "ProcessError", limit: 5, format: "json" }),
    buildChangedArgs({ testPath: "qa/", format: "json" }),
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

test("Cymbal v0.15.0 contracts in an isolated repository", { skip: !exactVersion }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-cymbal-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, "repo");
  const home = join(root, "home");
  for (const dir of [home, join(cwd, "src"), join(cwd, "qa")]) await mkdir(dir, { recursive: true });
  const env = { ...process.env, HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home, CYMBAL_NO_UPDATE_NOTIFIER: "1" };
  const files = {
    "src/seed.ts": "export function seed() {\n  return 1;\n}\n",
    "qa/bridge.ts": 'import { seed } from "../src/seed";\nexport function testBridge() {\n  return seed();\n}\n',
    "src/entry.ts": 'import { testBridge } from "../qa/bridge";\nexport function productionCaller() {\n  return testBridge();\n}\n',
    "README.md": "Non-code files are not in the inventory.\n",
  };
  for (const [path, content] of Object.entries(files)) await writeFile(join(cwd, path), content);
  for (const args of [["init", "-q"], ["add", "."], ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]]) {
    assertSuccess(spawnSync("git", args, { cwd, env, encoding: "utf8" }));
  }
  assertSuccess(run(buildIndexArgs({}), { cwd, env }));
  const json = (args) => {
    const result = run(args, { cwd, env });
    assertSuccess(result);
    return JSON.parse(result.stdout);
  };

  await t.test("inventory is sorted, filtered, and array-shaped when empty", () => {
    assert.deepEqual(json(buildMapArgs({ names: true, format: "json" })).results, ["qa/bridge.ts", "src/entry.ts", "src/seed.ts"]);
    assert.deepEqual(json(buildMapArgs({ names: true, pattern: "src/**", lang: "typescript", format: "json" })).results, ["src/entry.ts", "src/seed.ts"]);
    assert.deepEqual(json(buildMapArgs({ names: true, pattern: "missing/", format: "json" })).results, []);
    assert.deepEqual(json(buildMapArgs({ names: true, lang: "go", format: "json" })).results, []);
  });

  await t.test("investigate has one envelope for single, batch, and missing symbols", () => {
    for (const symbols of [["seed"], ["missingCymbalSymbol"], ["seed", "missingCymbalSymbol"]]) {
      const params = symbols.length === 1 ? { symbol: symbols[0] } : { symbols };
      const payload = json(buildInvestigateArgs({ ...params, format: "json" }));
      assert.equal(payload.version, "0.1");
      assert.deepEqual(payload.results.symbols, symbols);
      assert.equal(payload.results.resolve_scope, "family");
      assert.deepEqual(payload.results.results.map((entry) => entry.symbol), symbols);
      for (const entry of payload.results.results) {
        if (entry.symbol === "seed") assert.equal(entry.result.symbol.name, "seed");
        else assert.equal(entry.error, "not found");
      }
    }
  });

  await t.test("custom test paths affect metrics and preserve indirect production graph edges", () => {
    const options = { symbol: "seed", depth: 3, format: "json" };
    const before = json(buildImpactArgs(options)).results;
    const after = json(buildImpactArgs({ ...options, testPath: "qa/" })).results;
    assert.equal(before.metrics.production_reference_rows, 1);
    assert.equal(after.metrics.test_reference_rows, 1);
    assert.equal(after.metrics.production_reference_rows, 0);
    assert.equal(after.production_callers, 1);
    assert.equal(after.test_callers, 1);
    const graph = json(buildImpactArgs({ ...options, graph: true, noTests: true, testPath: ["qa/", "**/*_it.go"] })).results;
    assert.deepEqual(graph.nodes.map((node) => node.symbol).sort(), ["productionCaller", "seed"]);
    const seed = graph.nodes.find((node) => node.symbol === "seed");
    const caller = graph.nodes.find((node) => node.symbol === "productionCaller");
    assert.ok(graph.edges.some((edge) => edge.from === caller.id && edge.to === seed.id && edge.indirect === true));
  });

  await t.test("Glob nudges retain patterns, suppress explicit roots, and fall back for braces", () => {
    for (const [input, expected] of [
      [{ pattern: "**/*.ts" }, "cymbal ls --names '**/*.ts'"],
      [{ pattern: "**/*.ts", path: "." }, "cymbal ls --names '**/*.ts'"],
      [{ pattern: "**/*.ts", path: "src" }, undefined],
      [{ pattern: "**/*.ts", path: cwd }, undefined],
      [{ pattern: "**/*.{go,ts}" }, "cymbal ls --names"],
    ]) {
      const result = run(["hook", "nudge", "--format=json"], { cwd, env, input: buildNudgePayload("find", input) });
      assertSuccess(result);
      assert.equal(parseNudgeResponse(result.stdout)?.suggest, expected);
    }
  });

  await t.test("changed emits empty arrays and applies custom test-path classification", async () => {
    assert.deepEqual(json(buildChangedArgs({ format: "json" })).results.results, []);
    await writeFile(join(cwd, "src/seed.ts"), files["src/seed.ts"].replace("return 1", "return 2"));
    const before = json(buildChangedArgs({ format: "json" })).results.results[0];
    const after = json(buildChangedArgs({ testPath: "qa/", noTests: true, format: "json" })).results.results[0];
    assert.equal(after.symbol, "seed");
    assert.equal(before.references.production_reference_rows, 1);
    assert.equal(after.references.test_reference_rows, 1);
    assert.equal(after.impact.test_callers, 0);
    assert.equal(after.impact.production_callers, 1);
  });
});
