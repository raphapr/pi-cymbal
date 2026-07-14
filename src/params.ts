import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { normalizePathArg, type OutputFormat } from "./cymbal.js";

export const FormatParam = Type.Optional(StringEnum(["agent", "json"] as const, { description: "Output format. Defaults to agent-native Cymbal output." }));
export const GraphFormatParam = Type.Optional(StringEnum(["mermaid", "dot", "json"] as const));
export const ResolveScopeParam = Type.Optional(StringEnum(["same", "family", "all"] as const, { description: "Cross-language resolution scope. Defaults to family." }));

const BatchStrings = (description: string, minItems = 1) => Type.Array(Type.String(), { minItems, maxItems: 32, description });
const PathValues = (description: string) => Type.Union([Type.String(), BatchStrings(description)], { description });
const ResultLimit = (description: string) => Type.Integer({ minimum: 1, maximum: 10_000, description });
const ContextLines = (description: string) => Type.Integer({ minimum: 0, maximum: 1_000, description });
const GraphLimit = Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000, description: "Graph limit." }));

export const MapParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory scope. Defaults to ." })),
  depth: Type.Optional(Type.Integer({ minimum: 0, maximum: 100, description: "Tree depth passed to --depth." })),
  stats: Type.Optional(Type.Boolean({ description: "Include repository stats. Defaults to true." })),
  repos: Type.Optional(Type.Boolean({ description: "List indexed repositories instead of tree." })),
  format: FormatParam,
});

export const StructureParams = Type.Object({ limit: Type.Optional(ResultLimit("Maximum items per section.")), format: FormatParam });
export const DiffParams = Type.Object({
  symbol: Type.String({ description: "Symbol to diff." }),
  base: Type.Optional(Type.String({ description: "Git base revision. Defaults to HEAD." })),
  stat: Type.Optional(Type.Boolean({ description: "Show diffstat instead of full diff." })),
  format: FormatParam,
});
export const IndexParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory to index. Defaults to the current directory." })),
  force: Type.Optional(Type.Boolean({ description: "Force re-index all files." })),
  workers: Type.Optional(Type.Integer({ minimum: 0, maximum: 256, description: "Number of parallel workers." })),
  exclude: Type.Optional(PathValues("Exclude files matching this glob during indexing.")),
  includeGenerated: Type.Optional(Type.Boolean({ description: "Index generated files that are skipped by default." })),
  includeLargeFiles: Type.Optional(Type.Boolean({ description: "Index large source files that are skipped by default." })),
  format: FormatParam,
});
export const SearchParams = Type.Object({
  query: Type.Optional(Type.String({ description: "Symbol query, or text query when text is true." })),
  queries: Type.Optional(BatchStrings("Additional symbol queries.")),
  text: Type.Optional(Type.Boolean({ description: "Use Cymbal full-text search." })),
  exact: Type.Optional(Type.Boolean({ description: "Exact symbol match." })),
  ignoreCase: Type.Optional(Type.Boolean({ description: "Case-insensitive exact symbol match. Implies exact matching and is not supported with text search." })),
  kind: Type.Optional(Type.String({ description: "Filter by symbol kind." })),
  lang: Type.Optional(Type.String({ description: "Filter by language." })),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  path: Type.Optional(PathValues("Include path filter.")),
  exclude: Type.Optional(PathValues("Exclude path filter.")),
  format: FormatParam,
});
export const OutlineParams = Type.Object({
  files: BatchStrings("Files to outline."),
  names: Type.Optional(Type.Boolean({ description: "Emit one symbol name per line." })),
  signatures: Type.Optional(Type.Boolean({ description: "Include signatures." })),
  format: FormatParam,
});
export const ShowParams = Type.Object({
  target: Type.Optional(Type.String({ description: "Symbol, file path, or file range." })),
  targets: Type.Optional(BatchStrings("Symbols, file paths, or file ranges to show.")),
  all: Type.Optional(Type.Boolean({ description: "Show all matching symbol definitions." })),
  context: Type.Optional(ContextLines("Context lines.")),
  path: Type.Optional(PathValues("Include path filter.")),
  exclude: Type.Optional(PathValues("Exclude path filter.")),
  format: FormatParam,
});
export const RefsParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(BatchStrings("Additional target symbols.")),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  importers: Type.Optional(Type.Boolean({ description: "Include importers." })),
  impact: Type.Optional(Type.Boolean({ description: "Impact mode." })),
  depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "Depth for importers or impact mode." })),
  context: Type.Optional(ContextLines("Lines of context around each call site.")),
  file: Type.Optional(Type.String({ description: "Restrict refs to files that import or include the given path fragment." })),
  path: Type.Optional(PathValues("Include path filter.")),
  exclude: Type.Optional(PathValues("Exclude path filter.")),
  format: FormatParam,
});
export const ImpactParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(BatchStrings("Additional target symbols.")),
  context: Type.Optional(ContextLines("Lines of context around each call site.")),
  depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "Impact depth." })),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  noTests: Type.Optional(Type.Boolean({ description: "Exclude callers in test files from the impact set." })),
  resolveScope: ResolveScopeParam,
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: GraphLimit,
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  format: FormatParam,
});
export const ImportersParams = Type.Object({
  target: Type.String({ description: "File or package target." }),
  depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3, description: "Importer depth." })),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: GraphLimit,
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  format: FormatParam,
});
export const ImplsParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Symbol to query." })),
  symbols: Type.Optional(BatchStrings("Additional symbols to query.")),
  of: Type.Optional(Type.String({ description: "Find implementations of this symbol." })),
  lang: Type.Optional(Type.String({ description: "Filter by language." })),
  path: Type.Optional(PathValues("Include path filter.")),
  exclude: Type.Optional(PathValues("Exclude path filter.")),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: GraphLimit,
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  resolved: Type.Optional(Type.Boolean({ description: "Only show targets whose declaration is in the index." })),
  unresolved: Type.Optional(Type.Boolean({ description: "Only show external or unresolved targets." })),
  format: FormatParam,
});
export const InvestigateParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(BatchStrings("Additional target symbols.")),
  resolveScope: ResolveScopeParam,
  format: FormatParam,
});
export const TraceParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Target symbol." })),
  symbols: Type.Optional(BatchStrings("Additional target symbols.")),
  depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "Trace depth." })),
  kinds: Type.Optional(Type.String({ description: "Comma-separated ref kinds to follow." })),
  limit: Type.Optional(ResultLimit("Maximum results per symbol.")),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved targets in text, JSON, and graph output." })),
  resolveScope: ResolveScopeParam,
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: GraphLimit,
  format: FormatParam,
});
export const ChangedParams = Type.Object({
  staged: Type.Optional(Type.Boolean({ description: "Use staged changes instead of the working tree. Cannot be combined with base." })),
  base: Type.Optional(Type.String({ description: "Diff against this git base ref. Cannot be combined with staged." })),
  depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 5, description: "Impact depth." })),
  limit: Type.Optional(ResultLimit("Maximum results.")),
  maxSymbols: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000, description: "Maximum changed symbols to analyze." })),
  maxImpact: Type.Optional(Type.Integer({ minimum: 0, maximum: 100_000, description: "Maximum impacted symbols to report." })),
  noTests: Type.Optional(Type.Boolean({ description: "Exclude callers in test files from the impact set." })),
  resolveScope: ResolveScopeParam,
  format: FormatParam,
});
export const ContextParams = Type.Object({
  symbol: Type.String({ description: "Target symbol." }),
  callers: Type.Optional(ResultLimit("Maximum callers to show.")),
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
  limit?: number;
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
  limit?: number;
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

function assertInteger(name: string, value: number | undefined, minimum: number, maximum: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < minimum || value > maximum)) {
    throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
}

function pushNumber(args: string[], flag: string, value: number | undefined, minimum: number, maximum: number): void {
  assertInteger(flag, value, minimum, maximum);
  if (value !== undefined) args.push(flag, String(value));
}

interface GraphOptions {
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  format?: OutputFormat;
}

function graphRequested(options: GraphOptions): boolean {
  return options.graph === true || options.graphFormat !== undefined || options.graphLimit !== undefined;
}

export function effectiveOutputFormat(options: GraphOptions): OutputFormat {
  const requested = graphRequested(options);
  if (options.graph === false && (options.graphFormat !== undefined || options.graphLimit !== undefined)) {
    throw new Error("graph: false cannot be combined with graphFormat or graphLimit");
  }
  if ((options.graphFormat === "mermaid" || options.graphFormat === "dot") && options.format === "json") {
    throw new Error("format: json cannot be combined with Mermaid or DOT graph output");
  }
  if (!requested) return options.format ?? "agent";
  return options.graphFormat === "mermaid" || options.graphFormat === "dot" ? "agent" : "json";
}

function pushGraphArgs(args: string[], options: GraphOptions): void {
  effectiveOutputFormat(options);
  if (!graphRequested(options)) return;
  args.push("--graph", "--graph-format", options.graphFormat ?? "json");
  pushNumber(args, "--graph-limit", options.graphLimit, 0, 10_000);
}

function pushResolveScope(args: string[], scope?: "same" | "family" | "all"): void {
  if (scope) args.push("--resolve-scope", scope);
}

function pushString(args: string[], flag: string, value: string): void {
  if (value.startsWith("-")) args.push(`${flag}=${value}`);
  else args.push(flag, value);
}

function pushRepeatedPaths(args: string[], flag: string, values?: string | string[]): void {
  for (const value of asArray(values).map(normalizePathArg)) pushString(args, flag, value);
}

function boundedOperands(label: string, values: Array<string | undefined>, required = true): string[] {
  const operands = values.filter((candidate): candidate is string => Boolean(candidate));
  if (required && operands.length === 0) throw new Error(`${label} is required`);
  if (operands.length > 32) throw new RangeError(`${label} accepts at most 32 operands`);
  return operands;
}

function collectSymbols(symbol?: string, symbols?: string[]): string[] {
  return boundedOperands("symbol or symbols", [symbol, ...(symbols ?? [])]);
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
  if (params.stats ?? true) args.push("--stats");
  pushNumber(args, "--depth", params.depth, 0, 100);
  addJson(args, params.format);
  args.push("--", normalizePathArg(params.path ?? "."));
  return args;
}

export function buildStructureArgs(params: StructureArgs): string[] {
  const args = ["structure"];
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  return addJson(args, params.format);
}

export function buildDiffArgs(params: DiffArgs): string[] {
  const args = ["diff"];
  if (params.stat) args.push("--stat");
  addJson(args, params.format);
  args.push("--", params.symbol);
  if (params.base) args.push(params.base);
  return args;
}

export function buildIndexArgs(params: IndexArgs): string[] {
  const args = ["index"];
  if (params.force) args.push("--force");
  pushNumber(args, "--workers", params.workers, 0, 256);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  if (params.includeGenerated) args.push("--include-generated");
  if (params.includeLargeFiles) args.push("--include-large-files");
  addJson(args, params.format);
  if (params.path) args.push("--", normalizePathArg(params.path));
  return args;
}

export function buildSearchArgs(params: SearchArgs): string[] {
  if (params.ignoreCase && params.text) throw new Error("ignoreCase cannot be combined with text search");
  if (params.ignoreCase && params.exact === false) throw new Error("ignoreCase requires exact matching");
  const queries = boundedOperands(params.text ? "text mode query or queries" : "query or queries", [params.query, ...(params.queries ?? [])]);
  const args = ["search"];
  const exactSymbolSearch = params.exact || params.ignoreCase;
  if (params.text) args.push("--text");
  if (exactSymbolSearch) args.push("--exact");
  if (params.ignoreCase) args.push("--ignore-case");
  if (params.kind) pushString(args, "--kind", params.kind);
  if (params.lang) pushString(args, "--lang", params.lang);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  addJson(args, params.format);
  if (params.text) args.push("--", queries.join(" "));
  else args.push("--", ...(exactSymbolSearch ? queries : queries.map(escapeSymbolSearchQuery)));
  return args;
}

export function buildOutlineArgs(params: OutlineArgs): string[] {
  const files = boundedOperands("files", params.files);
  const args = ["outline"];
  if (params.names) args.push("--names");
  if (params.signatures) args.push("--signatures");
  addJson(args, params.format);
  args.push("--", ...files.map(normalizePathArg));
  return args;
}

function showTargets(params: ShowArgs): string[] {
  const targets = params.targets ?? [];
  if (params.target && targets.length) throw new Error("target and targets cannot be combined");
  return boundedOperands("target or targets", [params.target, ...targets]);
}

export function buildShowArgs(params: ShowArgs): string[] {
  const targets = showTargets(params);
  const args = ["show"];
  if (params.all) args.push("--all");
  pushNumber(args, "--context", params.context, 0, 1_000);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  addJson(args, params.format);
  args.push("--", ...targets.map(normalizePathArg));
  return args;
}

export function buildRefsArgs(params: RefsArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  const args = ["refs"];
  if (params.importers) args.push("--importers");
  if (params.impact) args.push("--impact");
  if (params.importers || params.impact) pushNumber(args, "--depth", params.depth, 1, params.importers ? 3 : 5);
  pushNumber(args, "--context", params.context, 0, 1_000);
  if (params.file) pushString(args, "--file", normalizePathArg(params.file));
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  addJson(args, params.format);
  args.push("--", ...symbols);
  return args;
}

export function buildImpactArgs(params: ImpactArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  const args = ["impact"];
  pushNumber(args, "--context", params.context, 0, 1_000);
  pushNumber(args, "--depth", params.depth, 1, 5);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  if (params.noTests) args.push("--no-tests");
  pushResolveScope(args, params.resolveScope);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  addJson(args, params.format);
  args.push("--", ...symbols);
  return args;
}

export function buildImportersArgs(params: ImportersArgs): string[] {
  const args = ["importers"];
  pushNumber(args, "--depth", params.depth, 1, 3);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  addJson(args, params.format);
  args.push("--", params.target);
  return args;
}

export function buildImplsArgs(params: ImplsArgs): string[] {
  if (params.resolved && params.unresolved) throw new Error("resolved cannot be combined with unresolved");
  if (params.of && (params.symbol || params.symbols?.length)) throw new Error("of cannot be combined with symbol or symbols");
  const symbols = boundedOperands("symbol or of", [params.symbol, ...(params.symbols ?? [])], Boolean(!params.of));
  const args = ["impls"];
  if (params.of) pushString(args, "--of", params.of);
  if (params.lang) pushString(args, "--lang", params.lang);
  pushRepeatedPaths(args, "--path", params.path);
  pushRepeatedPaths(args, "--exclude", params.exclude);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  if (params.resolved) args.push("--resolved");
  if (params.unresolved) args.push("--unresolved");
  addJson(args, params.format);
  if (symbols.length) args.push("--", ...symbols);
  return args;
}

export function buildInvestigateArgs(params: InvestigateArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  const args = ["investigate"];
  pushResolveScope(args, params.resolveScope);
  addJson(args, params.format);
  args.push("--", ...symbols);
  return args;
}

export function buildTraceArgs(params: TraceArgs): string[] {
  const symbols = collectSymbols(params.symbol, params.symbols);
  const args = ["trace"];
  pushNumber(args, "--depth", params.depth, 1, 5);
  if (params.kinds) pushString(args, "--kinds", params.kinds);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  if (params.includeUnresolved) args.push("--include-unresolved");
  pushResolveScope(args, params.resolveScope);
  pushGraphArgs(args, params);
  addJson(args, params.format);
  args.push("--", ...symbols);
  return args;
}

export function buildChangedArgs(params: ChangedArgs): string[] {
  if (params.staged && params.base) throw new Error("staged cannot be combined with base");
  const args = ["changed"];
  if (params.staged) args.push("--staged");
  if (params.base) pushString(args, "--base", params.base);
  pushNumber(args, "--depth", params.depth, 1, 5);
  pushNumber(args, "--limit", params.limit, 1, 10_000);
  pushNumber(args, "--max-symbols", params.maxSymbols, 0, 10_000);
  pushNumber(args, "--max-impact", params.maxImpact, 0, 100_000);
  if (params.noTests) args.push("--no-tests");
  pushResolveScope(args, params.resolveScope);
  return addJson(args, params.format);
}

export function buildContextArgs(params: ContextArgs): string[] {
  const args = ["context"];
  pushNumber(args, "--callers", params.callers, 1, 10_000);
  addJson(args, params.format);
  args.push("--", params.symbol);
  return args;
}
