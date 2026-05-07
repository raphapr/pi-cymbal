import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
import { normalizePathArg, type OutputFormat } from "./cymbal.js";

export const FormatParam = Type.Optional(StringEnum(["agent", "json"] as const, { description: "Output format. Defaults to agent-native Cymbal output." }));
export const GraphFormatParam = Type.Optional(StringEnum(["mermaid", "dot", "json"] as const));

export const MapParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Directory scope. Defaults to ." })),
  depth: Type.Optional(Type.Number({ description: "Tree depth passed to --depth." })),
  stats: Type.Optional(Type.Boolean({ description: "Include repository stats. Defaults to true." })),
  repos: Type.Optional(Type.Boolean({ description: "List indexed repositories instead of tree." })),
  format: FormatParam,
});

export const SearchParams = Type.Object({
  query: Type.String({ description: "Symbol query, or text query when text is true." }),
  queries: Type.Optional(Type.Array(Type.String(), { description: "Additional symbol queries." })),
  text: Type.Optional(Type.Boolean({ description: "Use Cymbal full-text search." })),
  exact: Type.Optional(Type.Boolean({ description: "Exact symbol match." })),
  kind: Type.Optional(Type.String({ description: "Filter by symbol kind." })),
  lang: Type.Optional(Type.String({ description: "Filter by language." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  path: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Include path filter." })),
  exclude: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())], { description: "Exclude path filter." })),
  stdin: Type.Optional(Type.Boolean({ description: "Reserved for future stdin query support." })),
  format: FormatParam,
});

export const OutlineParams = Type.Object({
  files: Type.Array(Type.String(), { description: "Files to outline." }),
  signatures: Type.Optional(Type.Boolean({ description: "Include signatures." })),
  format: FormatParam,
});

export const ShowParams = Type.Object({
  target: Type.String({ description: "Symbol, file path, or file range." }),
  context: Type.Optional(Type.Number({ description: "Context lines." })),
  format: FormatParam,
});

export const RefsParams = Type.Object({
  symbol: Type.String({ description: "Target symbol." }),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  importers: Type.Optional(Type.Boolean({ description: "Include importers." })),
  impact: Type.Optional(Type.Boolean({ description: "Impact mode." })),
  depth: Type.Optional(Type.Number({ description: "Depth for importers or impact mode." })),
  format: FormatParam,
});

export const ImpactParams = Type.Object({
  symbol: Type.String({ description: "Target symbol." }),
  depth: Type.Optional(Type.Number({ description: "Impact depth." })),
  limit: Type.Optional(Type.Number({ description: "Maximum results." })),
  format: FormatParam,
});

export const ImportersParams = Type.Object({
  target: Type.String({ description: "File or package target." }),
  depth: Type.Optional(Type.Number({ description: "Importer depth." })),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  format: FormatParam,
});

export const ImplsParams = Type.Object({
  symbol: Type.Optional(Type.String({ description: "Symbol to query." })),
  of: Type.Optional(Type.String({ description: "Find implementations of this symbol." })),
  graph: Type.Optional(Type.Boolean({ description: "Emit graph output." })),
  graphFormat: GraphFormatParam,
  graphLimit: Type.Optional(Type.Number({ description: "Graph limit." })),
  includeUnresolved: Type.Optional(Type.Boolean({ description: "Include unresolved graph nodes." })),
  format: FormatParam,
});

export const OptionalSymbolParams = Type.Object({
  symbol: Type.String({ description: "Target symbol." }),
  format: FormatParam,
});

export interface MapArgs {
  path?: string;
  depth?: number;
  stats?: boolean;
  repos?: boolean;
  format?: OutputFormat;
}

export interface SearchArgs {
  query: string;
  queries?: string[];
  text?: boolean;
  exact?: boolean;
  kind?: string;
  lang?: string;
  limit?: number;
  path?: string | string[];
  exclude?: string | string[];
  stdin?: boolean;
  format?: OutputFormat;
}

export interface OutlineArgs {
  files: string[];
  signatures?: boolean;
  format?: OutputFormat;
}

export interface ShowArgs {
  target: string;
  context?: number;
  format?: OutputFormat;
}

export interface RefsArgs {
  symbol: string;
  limit?: number;
  importers?: boolean;
  impact?: boolean;
  depth?: number;
  format?: OutputFormat;
}

export interface ImpactArgs {
  symbol: string;
  depth?: number;
  limit?: number;
  format?: OutputFormat;
}

export interface ImportersArgs {
  target: string;
  depth?: number;
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  format?: OutputFormat;
}

export interface ImplsArgs {
  symbol?: string;
  of?: string;
  graph?: boolean;
  graphFormat?: "mermaid" | "dot" | "json";
  graphLimit?: number;
  includeUnresolved?: boolean;
  format?: OutputFormat;
}

export interface OptionalSymbolArgs {
  symbol: string;
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

export function buildSearchArgs(params: SearchArgs): string[] {
  const args = ["search"];
  const paths = asArray(params.path).map(normalizePathArg);
  const excludes = asArray(params.exclude).map(normalizePathArg);

  if (params.text) {
    if (params.queries?.length) throw new Error("text mode accepts exactly one query");
    args.push("--text", params.query);
  } else {
    const queries = [params.query, ...(params.queries ?? [])];
    args.push(...(params.exact ? queries : queries.map(escapeSymbolSearchQuery)));
  }

  if (params.exact) args.push("--exact");
  if (params.kind) args.push("--kind", params.kind);
  if (params.lang) args.push("--lang", params.lang);
  pushNumber(args, "--limit", params.limit);
  for (const path of paths) args.push("--path", path);
  for (const exclude of excludes) args.push("--exclude", exclude);
  return addJson(args, params.format);
}

export function buildOutlineArgs(params: OutlineArgs): string[] {
  const args = ["outline", ...params.files.map(normalizePathArg)];
  if (params.signatures) args.push("--signatures");
  return addJson(args, params.format);
}

export function buildShowArgs(params: ShowArgs): string[] {
  const args = ["show", normalizePathArg(params.target)];
  pushNumber(args, "--context", params.context);
  return addJson(args, params.format);
}

export function buildRefsArgs(params: RefsArgs): string[] {
  const args = ["refs", params.symbol];
  if (params.importers) args.push("--importers");
  if (params.impact) args.push("--impact");
  if (params.importers || params.impact) pushNumber(args, "--depth", params.depth);
  pushNumber(args, "--limit", params.limit);
  return addJson(args, params.format);
}

export function buildImpactArgs(params: ImpactArgs): string[] {
  return buildRefsArgs({ symbol: params.symbol, impact: true, depth: params.depth, limit: params.limit, format: params.format });
}

export function buildImportersArgs(params: ImportersArgs): string[] {
  const args = ["importers", params.target];
  pushNumber(args, "--depth", params.depth);
  pushGraphArgs(args, params);
  return addJson(args, params.format);
}

export function buildImplsArgs(params: ImplsArgs): string[] {
  if (!params.symbol && !params.of) throw new Error("symbol or of is required");
  const args = ["impls"];
  if (params.of) args.push("--of", params.of);
  if (params.symbol) args.push(params.symbol);
  pushGraphArgs(args, params);
  if (params.includeUnresolved) args.push("--include-unresolved");
  return addJson(args, params.format);
}

export function buildInvestigateArgs(params: OptionalSymbolArgs): string[] {
  return addJson(["investigate", params.symbol], params.format);
}

export function buildTraceArgs(params: OptionalSymbolArgs): string[] {
  return addJson(["trace", params.symbol], params.format);
}

export function buildContextArgs(params: OptionalSymbolArgs): string[] {
  return addJson(["context", params.symbol], params.format);
}
