import assert from "node:assert/strict";
import test from "node:test";
import { Check } from "typebox/value";
import {
  buildChangedArgs,
  buildContextArgs,
  buildDiffArgs,
  buildImplsArgs,
  buildImpactArgs,
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
  ChangedParams,
  ImplsParams,
  ImpactParams,
  ImportersParams,
  InvestigateParams,
  MapParams,
  OutlineParams,
  SearchParams,
  ShowParams,
  TraceParams,
} from "../src/params.ts";

test("buildMapArgs maps stats and depth", () => {
  assert.deepEqual(buildMapArgs({ path: "@src", stats: true, depth: 2, format: "json" }), ["ls", "--stats", "--depth", "2", "--json", "--", "src"]);
});

test("buildMapArgs defaults to current path and stats", () => {
  assert.deepEqual(buildMapArgs({}), ["ls", "--stats", "--", "."]);
});

test("buildMapArgs rejects repos combinations", () => {
  assert.throws(() => buildMapArgs({ repos: true, path: "." }), /repos cannot be combined/);
});

test("buildStructureArgs maps limit", () => {
  assert.deepEqual(buildStructureArgs({ limit: 5, format: "json" }), ["structure", "--limit", "5", "--json"]);
});

test("buildDiffArgs maps base and stat", () => {
  assert.deepEqual(buildDiffArgs({ symbol: "buildSearchArgs", base: "main", stat: true, format: "json" }), ["diff", "--stat", "--json", "--", "buildSearchArgs", "main"]);
});

test("buildIndexArgs maps path and indexing flags", () => {
  assert.deepEqual(buildIndexArgs({ path: "@src", force: true, workers: 4, exclude: ["test", "dist"], includeGenerated: true, includeLargeFiles: true, format: "json" }), ["index", "--force", "--workers", "4", "--exclude", "test", "--exclude", "dist", "--include-generated", "--include-large-files", "--json", "--", "src"]);
});

test("buildSearchArgs maps symbol filters", () => {
  assert.deepEqual(buildSearchArgs({ query: "handleAuth", queries: ["UserService"], exact: true, kind: "function", lang: "typescript", limit: 10, path: ["src"], exclude: ["test"], format: "agent" }), ["search", "--exact", "--kind", "function", "--lang", "typescript", "--limit", "10", "--path", "src", "--exclude", "test", "--", "handleAuth", "UserService"]);
});

test("buildSearchArgs quotes hyphenated symbol queries", () => {
  assert.deepEqual(buildSearchArgs({ query: "registerCymbalHooks", queries: ["include-arguments"], limit: 20, path: "src" }), ["search", "--limit", "20", "--path", "src", "--", "registerCymbalHooks", "\"include-arguments\""]);
});

test("buildSearchArgs accepts additional queries without a primary query", () => {
  assert.deepEqual(buildSearchArgs({ queries: ["n8n_business", "api_gateway_n8n_shared"], limit: 20 }), ["search", "--limit", "20", "--", "n8n_business", "api_gateway_n8n_shared"]);
});

test("buildSearchArgs rejects empty symbol searches", () => {
  assert.throws(() => buildSearchArgs({}), /query or queries is required/);
});

test("buildSearchArgs maps text search", () => {
  assert.deepEqual(buildSearchArgs({ query: "needle", text: true, path: "src", format: "json" }), ["search", "--text", "--path", "src", "--json", "--", "needle"]);
});

test("buildSearchArgs joins text search query words", () => {
  assert.deepEqual(buildSearchArgs({ query: "needle", queries: ["other"], text: true }), ["search", "--text", "--", "needle other"]);
});

test("buildSearchArgs maps ignoreCase as exact unescaped symbol search", () => {
  assert.deepEqual(buildSearchArgs({ query: "include-arguments", ignoreCase: true }), ["search", "--exact", "--ignore-case", "--", "include-arguments"]);
});

test("buildSearchArgs rejects invalid ignoreCase combinations", () => {
  assert.throws(() => buildSearchArgs({ query: "needle", text: true, ignoreCase: true }), /ignoreCase cannot be combined with text/);
  assert.throws(() => buildSearchArgs({ query: "needle", ignoreCase: true, exact: false }), /ignoreCase requires exact matching/);
});

test("SearchParams does not expose deleted reserved input field", () => {
  const reservedInput = "std" + "in";
  assert.equal(SearchParams.properties?.[reservedInput], undefined);
});

test("buildOutlineArgs maps files, names, and signatures", () => {
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], names: true, signatures: true }), ["outline", "--names", "--signatures", "--", "src/index.ts"]);
});

test("buildOutlineArgs maps files and signatures", () => {
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], signatures: true }), ["outline", "--signatures", "--", "src/index.ts"]);
});

test("buildShowArgs maps context", () => {
  assert.deepEqual(buildShowArgs({ target: "@src/index.ts:1-10", context: 3, format: "json" }), ["show", "--context", "3", "--json", "--", "src/index.ts:1-10"]);
});

test("buildShowArgs maps multiple targets", () => {
  assert.deepEqual(buildShowArgs({ targets: ["@src/index.ts", "src/output.ts"], context: 2, format: "json" }), ["show", "--context", "2", "--json", "--", "src/index.ts", "src/output.ts"]);
});

test("buildShowArgs maps all and path filters", () => {
  assert.deepEqual(buildShowArgs({ target: "registerCymbalHooks", all: true, path: ["src", "test"], exclude: "dist" }), ["show", "--all", "--path", "src", "--path", "test", "--exclude", "dist", "--", "registerCymbalHooks"]);
});

test("buildShowArgs rejects invalid target combinations", () => {
  assert.throws(() => buildShowArgs({}), /target or targets is required/);
  assert.throws(() => buildShowArgs({ targets: [] }), /target or targets is required/);
  assert.throws(() => buildShowArgs({ target: "src/index.ts", targets: ["src/output.ts"] }), /target and targets cannot be combined/);
});

test("ShowParams exposes top-level properties for Pi tool adapters", () => {
  assert.equal(ShowParams.type, "object");
  assert.ok(ShowParams.properties?.target);
  assert.ok(ShowParams.properties?.targets);
  assert.equal(ShowParams.anyOf, undefined);
  assert.equal(Check(ShowParams, { target: "src/index.ts" }), true);
  assert.equal(Check(ShowParams, { targets: ["src/index.ts"] }), true);
  assert.equal(Check(ShowParams, { targets: [] }), false);
});

test("buildRefsArgs maps impact depth and limit", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", symbols: ["saveAuth"], impact: true, depth: 2, context: 3, file: "@src/index.ts", limit: 20, path: "src", exclude: ["test"] }), ["refs", "--impact", "--depth", "2", "--context", "3", "--file", "src/index.ts", "--limit", "20", "--path", "src", "--exclude", "test", "--", "handleAuth", "saveAuth"]);
});

test("buildRefsArgs does not pass depth without importers or impact", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", depth: 2 }), ["refs", "--", "handleAuth"]);
});

test("buildImpactArgs uses cymbal impact", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "handleAuth", symbols: ["saveAuth"], context: 1, depth: 2, limit: 5, format: "json" }), ["impact", "--context", "1", "--depth", "2", "--limit", "5", "--json", "--", "handleAuth", "saveAuth"]);
});

test("buildImpactArgs default call is unchanged (regression)", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "x" }), ["impact", "--", "x"]);
});

test("buildImpactArgs maps no-tests, resolve-scope, and graph family", () => {
  assert.deepEqual(
    buildImpactArgs({ symbol: "handleAuth", noTests: true, resolveScope: "family", graph: true, graphFormat: "dot", graphLimit: 25, includeUnresolved: true }),
    ["impact", "--no-tests", "--resolve-scope", "family", "--graph", "--graph-format", "dot", "--graph-limit", "25", "--include-unresolved", "--", "handleAuth"],
  );
});

test("buildTraceArgs default call is unchanged (regression)", () => {
  assert.deepEqual(buildTraceArgs({ symbol: "x" }), ["trace", "--", "x"]);
});

test("buildTraceArgs maps include-unresolved, resolve-scope, and graph family", () => {
  assert.deepEqual(
    buildTraceArgs({ symbol: "handleAuth", depth: 4, includeUnresolved: true, resolveScope: "all", graph: true, graphFormat: "mermaid", graphLimit: 10 }),
    ["trace", "--depth", "4", "--include-unresolved", "--resolve-scope", "all", "--graph", "--graph-format", "mermaid", "--graph-limit", "10", "--", "handleAuth"],
  );
});

test("buildInvestigateArgs maps resolve-scope", () => {
  assert.deepEqual(buildInvestigateArgs({ symbol: "handleAuth", resolveScope: "same" }), ["investigate", "--resolve-scope", "same", "--", "handleAuth"]);
});

test("buildChangedArgs defaults to bare changed", () => {
  assert.deepEqual(buildChangedArgs({}), ["changed"]);
});

test("buildChangedArgs maps staged and json", () => {
  assert.deepEqual(buildChangedArgs({ staged: true, format: "json" }), ["changed", "--staged", "--json"]);
});

test("buildChangedArgs maps base and tuning flags", () => {
  assert.deepEqual(
    buildChangedArgs({ base: "main", depth: 3, limit: 20, maxSymbols: 50, maxImpact: 100, noTests: true, resolveScope: "all" }),
    ["changed", "--base", "main", "--depth", "3", "--limit", "20", "--max-symbols", "50", "--max-impact", "100", "--no-tests", "--resolve-scope", "all"],
  );
});

test("buildChangedArgs rejects combining staged and base", () => {
  assert.throws(() => buildChangedArgs({ staged: true, base: "main" }), /staged.*base|base.*staged/);
});

test("resolveScope params reject values outside the enum", () => {
  for (const params of [ImpactParams, TraceParams, InvestigateParams, ChangedParams]) {
    assert.equal(Check(params, { resolveScope: "family" }), true);
    assert.equal(Check(params, { resolveScope: "bogus" }), false);
  }
});

test("buildImportersArgs maps include unresolved", () => {
  assert.deepEqual(buildImportersArgs({ target: "internal/auth", includeUnresolved: true }), ["importers", "--include-unresolved", "--", "internal/auth"]);
});

test("buildImportersArgs maps graph flags", () => {
  assert.deepEqual(buildImportersArgs({ target: "internal/auth", depth: 2, graph: true, graphFormat: "json", graphLimit: 50 }), ["importers", "--depth", "2", "--graph", "--graph-format", "json", "--graph-limit", "50", "--", "internal/auth"]);
});

test("buildImportersArgs preserves scoped package names", () => {
  assert.deepEqual(buildImportersArgs({ target: "@earendil-works/pi-ai" }), ["importers", "--", "@earendil-works/pi-ai"]);
});

test("buildImplsArgs requires symbol or of", () => {
  assert.throws(() => buildImplsArgs({}), /symbol or of/);
  assert.deepEqual(buildImplsArgs({ of: "Reader", includeUnresolved: true }), ["impls", "--of", "Reader", "--include-unresolved"]);
});

test("buildImplsArgs maps batch symbols and filters", () => {
  assert.deepEqual(buildImplsArgs({ symbol: "Reader", symbols: ["Writer"], lang: "go", path: ["src"], exclude: "test", resolved: true }), ["impls", "--lang", "go", "--path", "src", "--exclude", "test", "--resolved", "--", "Reader", "Writer"]);
});

test("buildImplsArgs rejects invalid combinations", () => {
  assert.throws(() => buildImplsArgs({ symbol: "Reader", resolved: true, unresolved: true }), /resolved cannot be combined with unresolved/);
  assert.throws(() => buildImplsArgs({ of: "Reader", symbols: ["Writer"] }), /of cannot be combined with symbol or symbols/);
});

test("buildImplsArgs does not pass unsupported depth flag", () => {
  assert.deepEqual(buildImplsArgs({ symbol: "Reader", depth: 2 }), ["impls", "--", "Reader"]);
});

test("positional builders place flags before an operand separator", () => {
  assert.deepEqual(buildDiffArgs({ symbol: "--help", base: "main", stat: true }), ["diff", "--stat", "--", "--help", "main"]);
  assert.deepEqual(buildOutlineArgs({ files: ["--json"], names: true }), ["outline", "--names", "--", "--json"]);
  assert.deepEqual(buildContextArgs({ symbol: "--help", callers: 3 }), ["context", "--callers", "3", "--", "--help"]);
});

test("model-controlled flag values cannot become Cymbal options", () => {
  assert.deepEqual(buildSearchArgs({ query: "--help", text: true }), ["search", "--text", "--", "--help"]);
  assert.deepEqual(buildShowArgs({ target: "x", path: "--json" }), ["show", "--path=--json", "--", "x"]);
  assert.deepEqual(buildChangedArgs({ base: "--help" }), ["changed", "--base=--help"]);
  assert.deepEqual(buildImplsArgs({ of: "--help" }), ["impls", "--of=--help"]);
  assert.deepEqual(buildTraceArgs({ symbol: "x", kinds: "--help" }), ["trace", "--kinds=--help", "--", "x"]);
});

test("graph requests have deterministic output and reject conflicts", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "x", graph: true }), ["impact", "--graph", "--graph-format", "json", "--", "x"]);
  assert.deepEqual(buildImportersArgs({ target: "pkg", graphLimit: 5 }), ["importers", "--graph", "--graph-format", "json", "--graph-limit", "5", "--", "pkg"]);
  assert.throws(() => buildImpactArgs({ symbol: "x", graph: false, graphLimit: 1 }), /graph: false/);
  assert.throws(() => buildImpactArgs({ symbol: "x", graphFormat: "dot", format: "json" }), /format: json/);
});

test("builders enforce combined operand cardinality and impls conflicts", () => {
  assert.throws(() => buildSearchArgs({ query: "one", queries: Array(32).fill("x") }), /at most 32/);
  assert.throws(() => buildImplsArgs({ symbol: "Reader", of: "Writer" }), /of cannot be combined/);
  assert.throws(() => buildOutlineArgs({ files: [] }), /files is required/);
});

test("numeric schemas enforce exact integer bounds", () => {
  assert.equal(Check(MapParams, { depth: -1 }), false);
  assert.equal(Check(MapParams, { depth: 1.5 }), false);
  assert.equal(Check(OutlineParams, { files: [] }), false);
  assert.equal(Check(ImportersParams, { target: "x", depth: 4 }), false);
  assert.equal(Check(ImplsParams, { symbol: "x", limit: 0 }), false);
  assert.equal(Check(ShowParams, { target: "x", context: 1001 }), false);
});

test("optional builders map guide-only commands", () => {
  assert.deepEqual(buildInvestigateArgs({ symbol: "handleAuth", symbols: ["saveAuth"], format: "json" }), ["investigate", "--json", "--", "handleAuth", "saveAuth"]);
  assert.deepEqual(buildTraceArgs({ symbol: "handleAuth", symbols: ["saveAuth"], depth: 4, kinds: "call,use", limit: 10 }), ["trace", "--depth", "4", "--kinds", "call,use", "--limit", "10", "--", "handleAuth", "saveAuth"]);
  assert.deepEqual(buildContextArgs({ symbol: "handleAuth", callers: 3 }), ["context", "--callers", "3", "--", "handleAuth"]);
});
