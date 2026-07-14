import { existsSync, readdirSync, realpathSync, statSync, type Dirent, type Stats } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { normalizePathArg } from "../cymbal.js";

export interface ResolvedRun<Params> {
  cwd: string;
  params: Params;
}

type StatPath = Pick<Stats, "isDirectory" | "isFile">;
export type PathClassification = "absolute" | "always" | "show" | "importer";

export interface RepoRootFs {
  stat: (path: string) => StatPath;
  exists: (path: string) => boolean;
  realpath?: (path: string) => string;
  platform?: NodeJS.Platform;
}

export interface PathFs extends RepoRootFs {
  readdir: (path: string, options: { withFileTypes: true }) => Dirent[];
}

const defaultFs: PathFs = {
  stat: statSync,
  exists: existsSync,
  realpath: realpathSync.native,
  readdir: readdirSync,
};

export function isDirectory(path: string, fs: RepoRootFs): boolean {
  try {
    return fs.stat(path).isDirectory();
  } catch {
    return false;
  }
}

function canonicalPath(path: string, fs: RepoRootFs): string {
  if (!fs.realpath) return path;
  const unresolved: string[] = [];
  let current = path;
  for (;;) {
    try {
      const canonical = fs.realpath(current);
      return unresolved.length ? join(canonical, ...unresolved.reverse()) : canonical;
    } catch {
      const parent = dirname(current);
      if (parent === current) return path;
      unresolved.push(basename(current));
      current = parent;
    }
  }
}

export function repoRootKey(path: string, fs: RepoRootFs = defaultFs): string {
  const canonical = canonicalPath(path, fs);
  return (fs.platform ?? process.platform) === "win32" ? canonical.toLowerCase() : canonical;
}

export function findRepoRoot(path: string, fs: RepoRootFs = defaultFs): string | undefined {
  let current = isDirectory(path, fs) ? path : dirname(path);

  for (;;) {
    if (fs.exists(join(current, ".git"))) return canonicalPath(current, fs);
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

interface TargetParts {
  path: string;
  suffix: string;
}

const SOURCE_EXTENSION = /\.(?:c|cc|cpp|cs|css|go|h|hpp|html?|java|js|jsx|kt|kts|lua|md|mjs|php|proto|py|rb|rs|scala|sh|sql|swift|toml|ts|tsx|vue|yaml|yml)$/i;

function looksLikePath(path: string): boolean {
  return isAbsolute(path) || path.startsWith("./") || path.startsWith("../") || path.includes("/") || path.includes("\\") || SOURCE_EXTENSION.test(path);
}

export function splitPathRangeSuffix(value: string): TargetParts {
  const range = /^(.*?)(:\d+(?:-\d+)?)$/.exec(value);
  if (range) return { path: range[1], suffix: range[2] };

  const lastColon = value.lastIndexOf(":");
  if (lastColon > 0 && !(lastColon === 1 && /^[A-Za-z]:[\\/]/.test(value))) {
    const path = value.slice(0, lastColon);
    if (looksLikePath(path)) return { path, suffix: value.slice(lastColon) };
  }
  return { path: value, suffix: "" };
}

function isShowPath(value: string): boolean {
  return looksLikePath(splitPathRangeSuffix(value).path);
}

export function resolvePathOperand(value: string, cwd: string, classification: PathClassification, fs: RepoRootFs = defaultFs): string {
  const normalized = classification === "importer" ? value : normalizePathArg(value);
  const parts = splitPathRangeSuffix(normalized);
  const explicitImporterPath = isAbsolute(parts.path) || parts.path.startsWith("./") || parts.path.startsWith("../");
  const importerPath = explicitImporterPath || (!normalized.startsWith("@") && fs.exists(resolve(cwd, parts.path)));
  const isPath = classification === "always"
    || (classification === "absolute" && isAbsolute(parts.path))
    || (classification === "show" && isShowPath(normalized))
    || (classification === "importer" && importerPath);
  if (!isPath) return normalized;
  return `${isAbsolute(parts.path) ? parts.path : resolve(cwd, parts.path)}${parts.suffix}`;
}

function absolutePathPart(value: string): string | undefined {
  const parts = splitPathRangeSuffix(value);
  return isAbsolute(parts.path) ? parts.path : undefined;
}

function scopedValue(value: string, repoRoot: string, omitRepoRoot: boolean, fs: RepoRootFs): string {
  const parts = splitPathRangeSuffix(value);
  if (!isAbsolute(parts.path)) return value;

  const operationalPath = canonicalPath(parts.path, fs);
  const scopedPath = relative(repoRoot, operationalPath) || ".";
  if (scopedPath.startsWith("..") || isAbsolute(scopedPath)) return value;
  const nextPath = omitRepoRoot && scopedPath === "." ? "." : scopedPath;
  return `${nextPath}${parts.suffix}`;
}

function rootFor(value: string, fs: RepoRootFs): string | undefined {
  const absolute = absolutePathPart(value);
  return absolute ? findRepoRoot(absolute, fs) : undefined;
}

function sameRepoRoot(values: string[], fs: RepoRootFs): string | undefined {
  const roots = values.map((value) => rootFor(value, fs));
  const root = roots[0];
  if (!root) return undefined;
  const key = repoRootKey(root, fs);
  return roots.every((candidate) => candidate !== undefined && repoRootKey(candidate, fs) === key) ? root : undefined;
}

function asPathArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pathFilterValue(paths: string[]): string | string[] | undefined {
  if (!paths.length) return undefined;
  return paths.length === 1 ? paths[0] : paths;
}

function absoluteFilterValues(value: string | string[] | undefined, cwd: string, fs: RepoRootFs): string[] {
  return asPathArray(value).map((path) => resolvePathOperand(path, cwd, "always", fs));
}

function scopedFilterValue(values: string[], repoRoot: string, omitRepoRoot: boolean, fs: RepoRootFs): string | string[] | undefined {
  const scoped = values
    .map((value) => {
      const next = scopedValue(value, repoRoot, omitRepoRoot, fs);
      return omitRepoRoot && next === "." ? undefined : next;
    })
    .filter((path): path is string => Boolean(path));
  return pathFilterValue(scoped);
}

export function resolvePathFilterRun<Params>(
  params: Params,
  cwd: string,
  options: {
    path?: string | string[];
    exclude?: string | string[];
    applyPath: (params: Params, value: string | string[] | undefined) => Params;
    applyExclude: (params: Params, value: string | string[] | undefined) => Params;
    targetRepoRoot?: string;
    fs?: RepoRootFs;
    errorPrefix?: string;
  },
): ResolvedRun<Params> {
  const fs = options.fs ?? defaultFs;
  const includeAbsolutes = absoluteFilterValues(options.path, cwd, fs);
  const excludeAbsolutes = absoluteFilterValues(options.exclude, cwd, fs);
  const targetRepoRoot = options.targetRepoRoot ? canonicalPath(options.targetRepoRoot, fs) : undefined;

  if (targetRepoRoot) {
    const targetKey = repoRootKey(targetRepoRoot, fs);
    for (const value of [...includeAbsolutes, ...excludeAbsolutes]) {
      const filterRoot = rootFor(value, fs);
      if (filterRoot && repoRootKey(filterRoot, fs) !== targetKey) {
        throw new Error(`${options.errorPrefix ?? "Cymbal tool"} path filters resolve to a different repository than the target; split them into separate calls.`);
      }
    }
  }

  const filterAbsolutes = [...includeAbsolutes, ...excludeAbsolutes];
  const filterRootKeys = new Set(
    filterAbsolutes
      .map((value) => rootFor(value, fs))
      .filter((root): root is string => Boolean(root))
      .map((root) => repoRootKey(root, fs)),
  );
  if (filterRootKeys.size > 1) {
    throw new Error(`${options.errorPrefix ?? "Cymbal tool"} path filters resolve to different repositories; split them into separate calls.`);
  }

  const filterRepoRoot = filterAbsolutes.length ? sameRepoRoot(filterAbsolutes, fs) : undefined;
  const repoRoot = targetRepoRoot ?? filterRepoRoot;
  if (!repoRoot) {
    const withPath = options.applyPath(params, pathFilterValue(includeAbsolutes));
    return { cwd, params: options.applyExclude(withPath, pathFilterValue(excludeAbsolutes)) };
  }

  const withPath = options.applyPath(params, scopedFilterValue(includeAbsolutes, repoRoot, true, fs));
  const withExclude = options.applyExclude(withPath, scopedFilterValue(excludeAbsolutes, repoRoot, false, fs));
  return { cwd: repoRoot, params: withExclude };
}

export function resolveSinglePathRun<Params>(
  params: Params,
  cwd: string,
  value: string | undefined,
  apply: (params: Params, value: string | undefined) => Params,
  options: { omitRepoRoot?: boolean; fs?: RepoRootFs; classification?: PathClassification } = {},
): ResolvedRun<Params> {
  if (!value) return { cwd, params };

  const fs = options.fs ?? defaultFs;
  const resolved = resolvePathOperand(value, cwd, options.classification ?? "absolute", fs);
  const absolute = absolutePathPart(resolved);
  if (!absolute) return { cwd, params: apply(params, resolved) };

  const repoRoot = findRepoRoot(absolute, fs);
  if (!repoRoot) return { cwd, params: apply(params, resolved) };

  return {
    cwd: repoRoot,
    params: apply(params, scopedValue(resolved, repoRoot, options.omitRepoRoot ?? false, fs)),
  };
}

export function resolveMultiPathRun<Params>(
  params: Params,
  cwd: string,
  values: string[],
  apply: (params: Params, values: string[]) => Params,
  options: { omitRepoRoot?: boolean; fs?: RepoRootFs; classification?: PathClassification } = {},
): ResolvedRun<Params> {
  const fs = options.fs ?? defaultFs;
  const resolved = values.map((value) => resolvePathOperand(value, cwd, options.classification ?? "absolute", fs));
  const rooted = resolved.map((value) => ({ value, root: rootFor(value, fs) })).filter((item) => item.root !== undefined);
  const rootKeys = new Set(rooted.map((item) => repoRootKey(item.root!, fs)));
  if (rootKeys.size > 1) throw new Error("Cymbal path operands resolve to different repositories; split them into separate calls.");

  const repoRoot = rooted.length === resolved.length ? sameRepoRoot(resolved, fs) : undefined;
  if (!repoRoot) return { cwd, params: apply(params, resolved) };

  return {
    cwd: repoRoot,
    params: apply(
      params,
      resolved.map((value) => scopedValue(value, repoRoot, options.omitRepoRoot ?? false, fs)),
    ),
  };
}

function nearestExistingDirectory(path: string, fs: PathFs): string | undefined {
  let current = isDirectory(path, fs) ? path : dirname(path);

  for (;;) {
    if (isDirectory(current, fs)) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function collectFiles(root: string, fs: PathFs, maxDepth: number, maxFiles: number): string[] {
  const files: string[] = [];

  function visit(dir: string, depth: number): void {
    if (depth > maxDepth || files.length >= maxFiles) return;

    let entries: Dirent[];
    try {
      entries = fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isFile()) files.push(fullPath);
      else if (entry.isDirectory()) visit(fullPath, depth + 1);
    }
  }

  visit(root, 0);
  return files;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function scoreCandidate(candidate: string, target: string): number {
  const candidateBase = basename(candidate).toLowerCase();
  const targetBase = basename(target).toLowerCase();
  let score = 0;

  if (candidateBase === targetBase) score += 200;
  if (candidateBase.includes(targetBase)) score += 120;
  if (targetBase.includes(candidateBase)) score += 80;

  for (const token of tokens(targetBase)) {
    if (candidateBase.includes(token)) score += 20;
  }

  const candidateLower = candidate.toLowerCase();
  for (const token of tokens(target)) {
    if (candidateLower.includes(token)) score += 5;
  }

  return score;
}

export function suggestNearbyFiles(cwd: string, target: string, limit = 5, fs: PathFs = defaultFs): string[] {
  const normalized = normalizePathArg(target);
  const targetPath = splitPathRangeSuffix(normalized).path;
  const absoluteTarget = isAbsolute(targetPath) ? targetPath : join(cwd, targetPath);
  const searchRoot = nearestExistingDirectory(absoluteTarget, fs);
  if (!searchRoot) return [];

  return collectFiles(searchRoot, fs, 3, 250)
    .map((file) => ({ file, score: scoreCandidate(file, absoluteTarget) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, limit)
    .map((entry) => {
      const relativePath = relative(cwd, entry.file);
      return relativePath && !relativePath.startsWith("..") ? relativePath : entry.file;
    });
}
