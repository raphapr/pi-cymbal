import assert from "node:assert/strict";
import test from "node:test";
import { Check } from "typebox/value";
import {
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
  SearchParams,
  ShowParams,
} from "../src/params.ts";

test("buildMapArgs maps stats and depth", () => {
  assert.deepEqual(buildMapArgs({ path: "@src", stats: true, depth: 2, format: "json" }), ["ls", "src", "--stats", "--depth", "2", "--json"]);
});

test("buildMapArgs defaults to current path and stats", () => {
  assert.deepEqual(buildMapArgs({}), ["ls", ".", "--stats"]);
});

test("buildMapArgs rejects repos combinations", () => {
  assert.throws(() => buildMapArgs({ repos: true, path: "." }), /repos cannot be combined/);
});

test("buildStructureArgs maps limit", () => {
  assert.deepEqual(buildStructureArgs({ limit: 5, format: "json" }), ["structure", "--limit", "5", "--json"]);
});

test("buildDiffArgs maps base and stat", () => {
  assert.deepEqual(buildDiffArgs({ symbol: "buildSearchArgs", base: "main", stat: true, format: "json" }), ["diff", "buildSearchArgs", "main", "--stat", "--json"]);
});

test("buildIndexArgs maps path and indexing flags", () => {
  assert.deepEqual(buildIndexArgs({ path: "@src", force: true, workers: 4, exclude: ["test", "dist"], includeGenerated: true, includeLargeFiles: true, format: "json" }), ["index", "src", "--force", "--workers", "4", "--exclude", "test", "--exclude", "dist", "--include-generated", "--include-large-files", "--json"]);
});

test("buildSearchArgs maps symbol filters", () => {
  assert.deepEqual(buildSearchArgs({ query: "handleAuth", queries: ["UserService"], exact: true, kind: "function", lang: "typescript", limit: 10, path: ["src"], exclude: ["test"], format: "agent" }), ["search", "handleAuth", "UserService", "--exact", "--kind", "function", "--lang", "typescript", "--limit", "10", "--path", "src", "--exclude", "test"]);
});

test("buildSearchArgs quotes hyphenated symbol queries", () => {
  assert.deepEqual(buildSearchArgs({ query: "registerCymbalHooks", queries: ["include-arguments"], limit: 20, path: "src" }), ["search", "registerCymbalHooks", "\"include-arguments\"", "--limit", "20", "--path", "src"]);
});

test("buildSearchArgs accepts additional queries without a primary query", () => {
  assert.deepEqual(buildSearchArgs({ queries: ["n8n_business", "api_gateway_n8n_shared"], limit: 20 }), ["search", "n8n_business", "api_gateway_n8n_shared", "--limit", "20"]);
});

test("buildSearchArgs rejects empty symbol searches", () => {
  assert.throws(() => buildSearchArgs({}), /query or queries is required/);
});

test("buildSearchArgs maps text search", () => {
  assert.deepEqual(buildSearchArgs({ query: "needle", text: true, path: "src", format: "json" }), ["search", "--text", "needle", "--path", "src", "--json"]);
});

test("buildSearchArgs joins text search query words", () => {
  assert.deepEqual(buildSearchArgs({ query: "needle", queries: ["other"], text: true }), ["search", "--text", "needle other"]);
});

test("buildSearchArgs maps ignoreCase as exact unescaped symbol search", () => {
  assert.deepEqual(buildSearchArgs({ query: "include-arguments", ignoreCase: true }), ["search", "include-arguments", "--exact", "--ignore-case"]);
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
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], names: true, signatures: true }), ["outline", "src/index.ts", "--names", "--signatures"]);
});

test("buildOutlineArgs maps files and signatures", () => {
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], signatures: true }), ["outline", "src/index.ts", "--signatures"]);
});

test("buildShowArgs maps context", () => {
  assert.deepEqual(buildShowArgs({ target: "@src/index.ts:1-10", context: 3, format: "json" }), ["show", "src/index.ts:1-10", "--context", "3", "--json"]);
});

test("buildShowArgs maps multiple targets", () => {
  assert.deepEqual(buildShowArgs({ targets: ["@src/index.ts", "src/output.ts"], context: 2, format: "json" }), ["show", "src/index.ts", "src/output.ts", "--context", "2", "--json"]);
});

test("buildShowArgs maps all and path filters", () => {
  assert.deepEqual(buildShowArgs({ target: "registerCymbalHooks", all: true, path: ["src", "test"], exclude: "dist" }), ["show", "registerCymbalHooks", "--all", "--path", "src", "--path", "test", "--exclude", "dist"]);
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
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", symbols: ["saveAuth"], impact: true, depth: 2, context: 3, file: "@src/index.ts", limit: 20, path: "src", exclude: ["test"] }), ["refs", "handleAuth", "saveAuth", "--impact", "--depth", "2", "--context", "3", "--file", "src/index.ts", "--limit", "20", "--path", "src", "--exclude", "test"]);
});

test("buildRefsArgs does not pass depth without importers or impact", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", depth: 2 }), ["refs", "handleAuth"]);
});

test("buildImpactArgs uses cymbal impact", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "handleAuth", symbols: ["saveAuth"], context: 1, depth: 2, limit: 5, format: "json" }), ["impact", "handleAuth", "saveAuth", "--context", "1", "--depth", "2", "--limit", "5", "--json"]);
});

test("buildImportersArgs maps include unresolved", () => {
  assert.deepEqual(buildImportersArgs({ target: "internal/auth", includeUnresolved: true }), ["importers", "internal/auth", "--include-unresolved"]);
});

test("buildImportersArgs maps graph flags", () => {
  assert.deepEqual(buildImportersArgs({ target: "internal/auth", depth: 2, graph: true, graphFormat: "json", graphLimit: 50 }), ["importers", "internal/auth", "--depth", "2", "--graph", "--graph-format", "json", "--graph-limit", "50"]);
});

test("buildImportersArgs preserves scoped package names", () => {
  assert.deepEqual(buildImportersArgs({ target: "@earendil-works/pi-ai" }), ["importers", "@earendil-works/pi-ai"]);
});

test("buildImplsArgs requires symbol or of", () => {
  assert.throws(() => buildImplsArgs({}), /symbol or of/);
  assert.deepEqual(buildImplsArgs({ of: "Reader", includeUnresolved: true }), ["impls", "--of", "Reader", "--include-unresolved"]);
});

test("buildImplsArgs maps batch symbols and filters", () => {
  assert.deepEqual(buildImplsArgs({ symbol: "Reader", symbols: ["Writer"], lang: "go", path: ["src"], exclude: "test", resolved: true }), ["impls", "Reader", "Writer", "--lang", "go", "--path", "src", "--exclude", "test", "--resolved"]);
});

test("buildImplsArgs rejects invalid combinations", () => {
  assert.throws(() => buildImplsArgs({ symbol: "Reader", resolved: true, unresolved: true }), /resolved cannot be combined with unresolved/);
  assert.throws(() => buildImplsArgs({ of: "Reader", symbols: ["Writer"] }), /of cannot be combined with symbols/);
});

test("buildImplsArgs does not pass unsupported depth flag", () => {
  assert.deepEqual(buildImplsArgs({ symbol: "Reader", depth: 2 }), ["impls", "Reader"]);
});

test("optional builders map guide-only commands", () => {
  assert.deepEqual(buildInvestigateArgs({ symbol: "handleAuth", symbols: ["saveAuth"], format: "json" }), ["investigate", "handleAuth", "saveAuth", "--json"]);
  assert.deepEqual(buildTraceArgs({ symbol: "handleAuth", symbols: ["saveAuth"], depth: 4, kinds: "call,use", limit: 10 }), ["trace", "handleAuth", "saveAuth", "--depth", "4", "--kinds", "call,use", "--limit", "10"]);
  assert.deepEqual(buildContextArgs({ symbol: "handleAuth", callers: 3 }), ["context", "handleAuth", "--callers", "3"]);
});
