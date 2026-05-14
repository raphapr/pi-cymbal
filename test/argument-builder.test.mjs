import assert from "node:assert/strict";
import test from "node:test";
import { Check } from "typebox/value";
import {
  buildContextArgs,
  buildImplsArgs,
  buildImpactArgs,
  buildImportersArgs,
  buildInvestigateArgs,
  buildMapArgs,
  buildOutlineArgs,
  buildRefsArgs,
  buildSearchArgs,
  buildShowArgs,
  buildTraceArgs,
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

test("buildOutlineArgs maps files and signatures", () => {
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], signatures: true }), ["outline", "src/index.ts", "--signatures"]);
});

test("buildShowArgs maps context", () => {
  assert.deepEqual(buildShowArgs({ target: "@src/index.ts:1-10", context: 3, format: "json" }), ["show", "src/index.ts:1-10", "--context", "3", "--json"]);
});

test("buildShowArgs maps multiple targets", () => {
  assert.deepEqual(buildShowArgs({ targets: ["@src/index.ts", "src/output.ts"], context: 2, format: "json" }), ["show", "src/index.ts", "src/output.ts", "--context", "2", "--json"]);
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
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", impact: true, depth: 2, limit: 20 }), ["refs", "handleAuth", "--impact", "--depth", "2", "--limit", "20"]);
});

test("buildRefsArgs does not pass depth without importers or impact", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", depth: 2 }), ["refs", "handleAuth"]);
});

test("buildImpactArgs uses cymbal impact", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "handleAuth", depth: 2, limit: 5, format: "json" }), ["impact", "handleAuth", "--depth", "2", "--limit", "5", "--json"]);
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

test("buildImplsArgs does not pass unsupported depth flag", () => {
  assert.deepEqual(buildImplsArgs({ symbol: "Reader", depth: 2 }), ["impls", "Reader"]);
});

test("optional builders map guide-only commands", () => {
  assert.deepEqual(buildInvestigateArgs({ symbol: "handleAuth", format: "json" }), ["investigate", "handleAuth", "--json"]);
  assert.deepEqual(buildTraceArgs({ symbol: "handleAuth" }), ["trace", "handleAuth"]);
  assert.deepEqual(buildContextArgs({ symbol: "handleAuth" }), ["context", "handleAuth"]);
});
