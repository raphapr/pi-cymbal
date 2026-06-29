import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { normalizePathArg, type OutputFormat } from "./cymbal.js";

export const FormatParam = Type.Optional(StringEnum(["agent", "json"] as const, { description: "Output format. Defaults to agent-native Cymbal output." }));
export const GraphFormatParam = Type.Optional(StringEnum(["mermaid", "dot", "json"] as const));
export const ResolveScopeParam = Type.Optional(StringEnum(["same", "family", "all"] as const, { description: "Cross-language resolution scope. Defaults to family." }));

export const MapParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory scope. Defaults to ." })),
  depth: Type.Optional(Type.Number({ description: "Tree depth passed to --depth." })),
  stats: Type.Optional(Type.Boolean({ description: "Include repository stats. Defaults to true." })),
  repos: Type.Optional(Type.Boolean({ description: "List indexed repositories instead of tree." })),
  format: FormatParam,
});

export const StructureParams = Type.Object({
  limit: Type.Optional(Type.Number({ description: "Maximum items per section." })),
  format: FormatParam,
});

export const DiffParams = Type.Object({
  symbol: Type.String({ description: "Symbol to diff." }),
  base: Type.Optional(Type.String({ description: "Git base revision. Defaults to HEAD." })),
  stat: Type.Optional(Type.Boolean({ description: "Show diffstat instead of full diff." })),
  format: FormatParam,
});

export const IndexParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory to index. Defaults to the current directory." })),
  force: Type.Optional(Type.Boolean({ description: "Force re-index all files." })),
  workers: Type.Optional(Type.Number({ description: "Number of parallel workers." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude files matching this glob during indexing." })),
  includeGenerated: Type.Optional(Type.Boolean({ description: "Index generated files that are skipped by default." })),
  includeLargeFiles: Type.Optional(Type.Boolean({ description: "Index large source files that are skipped by default." })),
  format: FormatParam,
});

export const SearchParams = Type.Object({
  query: Type.Optional(Type.String({ description: "Symbol query, or text query when text is true." })),
  queries: Type.Optional(Type.Array(Type.String(), { description: "Additional symbol queries." })),
  text: Type.Optional(Type.Boolean({ description: "Use Cymbal full-text search." })),
  exact: Type.Optional(Type.Boolean({ description: "Exact symbol match." })),
  ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive exact symbol match. Implies exact matching and is not supported with text search." })),
  kind: Type.Optional(Type.String({ description: "Filter by symbol kind." })),
  lang: Type.Optional(Type.String({ description: "Filter by language." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  path: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Include path filter." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude path filter." })),
  format: FormatParam,
});

export const OutlineParams = Type.Object({
  files: Type.Array(Type.String(), { description: "Files to outline." }),
  names: Type.Optional(Type.Boolean({ description: "Emit one symbol name per line." })),
  signatures: Type.Optional(Type.Boolean({ description: "Include signatures." })),
  format: FormatParam,
});

export const ShowParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Symbol, file path, or file range." })),
  targets: Type.Optional(Type.Array(Type.String(), { minItems: 1, description: "Symbols, file paths, or file ranges to show." })),
  all: Type.Optional(Type.Boolean({ description: "Show all matching symbol definitions." })),
  context: Type.Optional(Type.Number({ description: "Context lines." })),
  path: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Include path filter." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude path filter." })),
  format: FormatParam,
});

export const RefsParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(Type.Array(Type.String(), { description: "Additional target symbols." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  importers: Type.Optional(Type.Boolean({ description: "Include importers." })),
  impact: Type.Optional(Type.Boolean({ description: "Impact mode." })),
  depth: Type.Optional(Type.Number({ description: "Depth for importers or impact mode." })),
  context: Type.Optional(Type.Number({ description: "Lines of context around each call site." })),
  file: Type.Optional(Type.String({ description: "Restrict refs to files that import or include the given path fragment." })),
  path: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Include path filter." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude path filter." })),
  format: FormatParam,
});

export const ImpactParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(Type.Array(Type.String(), { description: "Additional target symbols." })),
  context: Type.Optional(Type.Number({ description: "Lines of context around each call site." })),
  depth: Type.Optional(Type.Number({ description: "Impact depth." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  noTests: Type.Optional(Type.Boolean({ description: "Exclude callers in test files from the impact set." })),
  resolveScope: ResolveScopeParam,
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  format: FormatParam,
});

export const ImportersParams = Type.Object({
  target: Type.String({ description: "File or package target." }),
  depth: Type.Optional(Type.Number({ description: "Importer depth." })),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  format: FormatParam,
});

export const ImplsParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Symbol to query." })),
  symbols: Type.Optional(Type.Array(Type.String(), { description: "Additional symbols to query." })),
  of: Type.Optional(Type.String({ description: "Find implementations of this symbol." })),
  lang: Type.Optional(Type.String({ description: "Filter by language." })),
  path: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Include path filter." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude path filter." })),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  resolved: Type.Optional(Type.Boolean({ description: "Only show targets whose declaration is in the index." })),
  unresolved: Type.Optional(Type.Boolean({ description: "Only show external or unresolved targets." })),
  format: FormatParam,
});

export const InvestigateParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(Type.Array(Type.String(), { description: "Additional target symbols." })),
  resolveScope: ResolveScopeParam,
  format: FormatParam,
});

export const TraceParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(Type.Array(Type.String(), { description: "Additional target symbols." })),
  depth: Type.Optional(Type.Number({ description: "Trace depth." })),
  kinds: Type.Optional(Type.String({ description: "Comma-separated ref kinds to follow." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results per symbol." })),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved targets in text, JSON, and graph output." })),
  resolveScope: ResolveScopeParam,
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  format: FormatParam,
});

export const ChangedParams = Type.Object({
  staged: Type.Optional(Type.Boolean({ description: "Use staged changes instead of the working tree. Cannot be combined with base." })),
  base: Type.Optional(Type.String({ description: "Diff against this git base ref. Cannot be combined with staged." })),
  depth: Type.Optional(Type.Number({ description: "Impact depth." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  maxSymbols: Type.Optional(Type.Number({ description: "Maximum changed symbols to analyze." })),
  maxImpact: Type.Optional(Type.Number({ description: "Maximum impacted symbols to report." })),
  noTests: Type.Optional(Type.Boolean({ description: "Exclude callers in test files from the impact set." })),
  resolveScope: ResolveScopeParam,
  format: FormatParam,
});

export const ContextParams = Type.Object({
  symbol: Type.String({ description: "Target symbol." }),
  callers: Type.Optional(Type.Number({ description: "Maximum callers to show." })),
  format: FormatParam,
});

export interface MapArgs {
  path?: string;
  depth?: number;
  stats?: boolean;
  repos?: boolean;
  format?: OutputFormat;
}

export interface StructureArgs {
  limit?: number;
  format?: OutputFormat;
}

export interface DiffArgs {
  symbol: string;
  base?: string;
  stat?: boolean;
  format?: OutputFormat;
}

export interface IndexArgs {
  path?: string;
  force?: boolean;
  workers?: number;
  exclude?: string | string[];
  includeGenerated?: boolean;
  includeLargeFiles?: boolean;
  format?: OutputFormat;
}

export interface SearchArgs {
  query?: string;
  queries?: string[];
  text?: boolean;
  exact?: boolean;
  ignoreCase?: boolean;
  kind?: string;
  lang?: string;
  limit?: number;
  path?: string | string[];
  exclude?: string | string[];
  format?: OutputFormat;
}

export interface OutlineArgs {
  files: string[];
  names?: boolean;
  signatures?: boolean;
  format?: OutputFormat;
}

export interface ShowArgs {
  target?: string;
  targets?: string[];
  all?: boolean;
  context?: number;
  path?: string | string[];
  exclude?: string | string[];
  format?: OutputFormat;
}

export interface RefsArgs {
  symbol?: string;
  symbols?: string[];
  limit?: number;
  importers?: boolean;
  impact?: boolean;
  depth?: number;
  context?: number;
  file?: string;
  path?: string | string[];
  exclude?: string | string[];
  format?: OutputFormat;
}

export interface ImpactArgs {
  symbol?: string;
  symbols?: string[];
  context?: number;
  depth?: number;
  limit?: number;
  noTests?: boolean;
  resolveScope?: "same" | "family" | "all";
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  includeUnresolved?: boolean;
  format?: OutputFormat;
}

export interface ImportersArgs {
  target: string;
  depth?: number;
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  includeUnresolved?: boolean;
  format?: OutputFormat;
}

export interface ImplsArgs {
  symbol?: string;
  symbols?: string[];
  of?: string;
  lang?: string;
  path?: string | string[];
  exclude?: string | string[];
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  includeUnresolved?: boolean;
  resolved?: boolean;
  unresolved?: boolean;
  format?: OutputFormat;
}

export interface InvestigateArgs {
  symbol?: string;
  symbols?: string[];
  resolveScope?: "same" | "family" | "all";
  format?: OutputFormat;
}

export interface TraceArgs {
  symbol?: string;
  symbols?: string[];
  depth?: number;
  kinds?: string;
  limit?: number;
  includeUnresolved?: boolean;
  resolveScope?: "same" | "family" | "all";
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  format?: OutputFormat;
}

export interface ChangedArgs {
  staged?: boolean;
  base?: string;
  depth?: number;
  limit?: number;
  maxSymbols?: number;
  maxImpact?: number;
  noTests?: boolean;
  resolveScope?: "same" | "family" | "all";
  format?: OutputFormat;
}

export interface ContextArgs {
  symbol: string;
  callers?: number;
  format?: OutputFormat;
}

function addJson(args: string[], format?: OutputFormat): string[] {
  if (format === "json") args.push("--json");
  return args;
}

function asArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pushNumber(args: string[], flag: string, value?: number): void {
  if (value !== undefined) args.push(flag, String(value));
}

function pushGraphArgs(args: string[], options: { graph?: boolean; graphFormat?: string; graphLimit?: number }): void {
  if (options.graph) args.push("--graph");
  if (options.graphFormat) args.push("--graph-format", options.graphFormat);
  pushNumber(args, "--graph-limit", options.graphLimit);
}

function pushResolveScope(args: string[], scope?: "same" | "family" | "all"): void {
  if (scope) args.push("--resolve-scope", scope);
}

function pushRepeatedPaths(args: string[], flag: string, values?: string | string[]): void {
  for (const value of asArray(values).map(normalizePathArg)) args.push(flag, value);
}

function collectSymbols(symbol?: string, symbols?: string[]): string[] {
  return [symbol, ...(symbols ?? [])].filter((candidate): candidate is string => Boolean(candidate));
}

function escapeSymbolSearchQuery(query: string): string {
  if (!/[^A-Za-z0-9_\s]/.test(query)) return query;
  if (query.startsWith('"') && query.endsWith('"')) return query;
  return `"${query.replaceAll('"', '""')}"`;
}

export function buildMapArgs(params: MapArgs): string[] {
  if (params.repos && (params.path !== undefined || params.depth !== undefined || params.stats !== undefined)) {
    throw new Error("repos cannot be combined with path, depth, or stats");
  }
  const args = ["ls"];
  if (params.repos) {
    args.push("--repos");
    return addJson(args, params.format);
  }
  args.push(normalizePathArg(params.path ?? "."));
  if (params.stats ?? true) args.push("--stats");
  pushNumber(args, "--depth", params.depth);
  return addJson(args, params.format);
}

export function buildStructureArgs(params: StructureArgs): string[] {
  const args = ["structure"];
  pushNumber(args, "--limit", params.limit);
  return addJson(args, params.format);
}

export function buildDiffArgs(params: DiffArgs): string[] {
  const args = ["diff", params.symbol];
  if (params.base) args.push(params.base);
  if (params.stat) args.push("--stat");
  return addJson(args, params.format);
}

export function buildIndexArgs(params: IndexArgs): string[] {
  const args = ["index"];
  if (params.path) args.push(normalizePathArg(params.path));
  if (params.force) args.push("--force");
  pushNumber(args, "--workers", params.workers);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  if (params.includeGenerated) args.push("--include-generated");
  if (params.includeLargeFiles) args.push("--include-large-files");
  return addJson(args, params.format);
}

export function buildSearchArgs(params: SearchArgs): string[] {
  if (params.ignoreCase && params.text) throw new Error("ignoreCase cannot be combined with text search");
  if (params.ignoreCase && params.exact === false) throw new Error("ignoreCase requires exact matching");

  const args = ["search"];
  const exactSymbolSearch = params.exact || params.ignoreCase;

  if (params.text) {
    const queries = [params.query, ...(params.queries ?? [])].filter((query): query is string => Boolean(query));
    if (!queries.length) throw new Error("text mode requires query or queries");
    args.push("--text", queries.join(" "));
  } else {
    const queries = [params.query, ...(params.queries ?? [])].filter((query): query is string => Boolean(query));
    if (!queries.length) throw new Error("query or queries is required");
    args.push(...(exactSymbolSearch ? queries : queries.map(escapeSymbolSearchQuery)));
  }

  if (exactSymbolSearch) args.push("--exact");
  if (params.ignoreCase) args.push("--ignore-case");
  if (params.kind) args.push("--kind", params.kind);
  if (params.lang) args.push("--lang", params.lang);
  pushNumber(args, "--limit", params.limit);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  return addJson(args, params.format);
}

export function buildOutlineArgs(params: OutlineArgs): string[] {
  const args = ["outline", ...params.files.map(normalizePathArg)];
  if (params.names) args.push("--names");
  if (params.signatures) args.push("--signatures");
  return addJson(args, params.format);
}

function showTargets(params: ShowArgs): string[] {
  const targets = params.targets ?? [];
  if (params.target && targets.length) throw new Error("target and targets cannot be combined");
  if (params.target) return [params.target];
  if (targets.length) return targets;
  throw new Error("target or targets is required");
}

export function buildShowArgs(params: ShowArgs): string[] {
  const args = ["show", ...showTargets(params).map(normalizePathArg)];
  if (params.all) args.push("--all");
  pushNumber(args, "--context", params.context);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  return addJson(args, params.format);
}

export function buildRefsArgs(params: RefsArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  if (!symbols.length) throw new Error("symbol or symbols is required");
  const args = ["refs", ...symbols];
  if (params.importers) args.push("--importers");
  if (params.impact) args.push("--impact");
  if (params.importers || params.impact) pushNumber(args, "--depth", params.depth);
  pushNumber(args, "--context", params.context);
  if (params.file) args.push("--file", normalizePathArg(params.file));
  pushNumber(args, "--limit", params.limit);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  return addJson(args, params.format);
}

export function buildImpactArgs(params: ImpactArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  if (!symbols.length) throw new Error("symbol or symbols is required");
  const args = ["impact", ...symbols];
  pushNumber(args, "--context", params.context);
  pushNumber(args, "--depth", params.depth);
  pushNumber(args, "--limit", params.limit);
  if (params.noTests) args.push("--no-tests");
  pushResolveScope(args, params.resolveScope);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  return addJson(args, params.format);
}

export function buildImportersArgs(params: ImportersArgs): string[] {
  const args = ["importers", params.target];
  pushNumber(args, "--depth", params.depth);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  return addJson(args, params.format);
}

export function buildImplsArgs(params: ImplsArgs): string[] {
  if (params.resolved && params.unresolved) throw new Error("resolved cannot be combined with unresolved");
  if (params.of && params.symbols?.length) throw new Error("of cannot be combined with symbols");

  const symbols = collectSymbols(params.symbol, params.symbols);
  if (!symbols.length && !params.of) throw new Error("symbol or of is required");
  const args = ["impls"];
  if (params.of) args.push("--of", params.of);
  args.push(...symbols);
  if (params.lang) args.push("--lang", params.lang);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  if (params.resolved) args.push("--resolved");
  if (params.unresolved) args.push("--unresolved");
  return addJson(args, params.format);
}

export function buildInvestigateArgs(params: InvestigateArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  if (!symbols.length) throw new Error("symbol or symbols is required");
  const args = ["investigate", ...symbols];
  pushResolveScope(args, params.resolveScope);
  return addJson(args, params.format);
}

export function buildTraceArgs(params: TraceArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  if (!symbols.length) throw new Error("symbol or symbols is required");
  const args = ["trace", ...symbols];
  pushNumber(args, "--depth", params.depth);
  if (params.kinds) args.push("--kinds", params.kinds);
  pushNumber(args, "--limit", params.limit);
  if (params.includeUnresolved) args.push("--include-unresolved");
  pushResolveScope(args, params.resolveScope);
  pushGraphArgs(args, params);
  return addJson(args, params.format);
}

export function buildChangedArgs(params: ChangedArgs): string[] {
  if (params.staged && params.base) throw new Error("staged cannot be combined with base");
  const args = ["changed"];
  if (params.staged) args.push("--staged");
  if (params.base) args.push("--base", params.base);
  pushNumber(args, "--depth", params.depth);
  pushNumber(args, "--limit", params.limit);
  pushNumber(args, "--max-symbols", params.maxSymbols);
  pushNumber(args, "--max-impact", params.maxImpact);
  if (params.noTests) args.push("--no-tests");
  pushResolveScope(args, params.resolveScope);
  return addJson(args, params.format);
}

export function buildContextArgs(params: ContextArgs): string[] {
  const args = ["context", params.symbol];
  pushNumber(args, "--callers", params.callers);
  return addJson(args, params.format);
}
