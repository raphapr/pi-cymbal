import assert from "node:assert/strict";
import test from "node:test";
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

test("buildSearchArgs maps text search", () => {
  assert.deepEqual(buildSearchArgs({ query: "needle", text: true, path: "src", format: "json" }), ["search", "--text", "needle", "--path", "src", "--json"]);
});

test("buildSearchArgs rejects batch text search", () => {
  assert.throws(() => buildSearchArgs({ query: "needle", queries: ["other"], text: true }), /text mode accepts exactly one query/);
});

test("buildOutlineArgs maps files and signatures", () => {
  assert.deepEqual(buildOutlineArgs({ files: ["@src/index.ts"], signatures: true }), ["outline", "src/index.ts", "--signatures"]);
});

test("buildShowArgs maps context", () => {
  assert.deepEqual(buildShowArgs({ target: "@src/index.ts:1-10", context: 3, format: "json" }), ["show", "src/index.ts:1-10", "--context", "3", "--json"]);
});

test("buildRefsArgs maps impact depth and limit", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", impact: true, depth: 2, limit: 20 }), ["refs", "handleAuth", "--impact", "--depth", "2", "--limit", "20"]);
});

test("buildRefsArgs does not pass depth without importers or impact", () => {
  assert.deepEqual(buildRefsArgs({ symbol: "handleAuth", depth: 2 }), ["refs", "handleAuth"]);
});

test("buildImpactArgs uses refs --impact", () => {
  assert.deepEqual(buildImpactArgs({ symbol: "handleAuth", depth: 2, format: "json" }), ["refs", "handleAuth", "--impact", "--depth", "2", "--json"]);
});

test("buildImportersArgs maps graph flags", () => {
  assert.deepEqual(buildImportersArgs({ target: "internal/auth", depth: 2, graph: true, graphFormat: "json", graphLimit: 50 }), ["importers", "internal/auth", "--depth", "2", "--graph", "--graph-format", "json", "--graph-limit", "50"]);
});

test("buildImportersArgs preserves scoped package names", () => {
  assert.deepEqual(buildImportersArgs({ target: "@mariozechner/pi-ai" }), ["importers", "@mariozechner/pi-ai"]);
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
