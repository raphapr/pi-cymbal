import { existsSync, readdirSync, statSync, type Dirent, type Stats } from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { normalizePathArg } from "../cymbal.js";

export interface ResolvedRun<Params> {
  cwd: string;
  params: Params;
}

type StatPath = Pick<Stats, "isDirectory" | "isFile">;

export interface RepoRootFs {
  stat: (path: string) => StatPath;
  exists: (path: string) => boolean;
}

export interface PathFs extends RepoRootFs {
  readdir: (path: string, options: { withFileTypes: true }) => Dirent[];
}

const defaultFs: PathFs = {
  stat: statSync,
  exists: existsSync,
  readdir: readdirSync,
};

export function isDirectory(path: string, fs: RepoRootFs): boolean {
  try {
    return fs.stat(path).isDirectory();
  } catch {
    return false;
  }
}

export function findRepoRoot(path: string, fs: RepoRootFs = defaultFs): string | undefined {
  let current = isDirectory(path, fs) ? path : dirname(path);

  for (;;) {
    if (fs.exists(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

interface TargetParts {
  path: string;
  suffix: string;
}

export function splitPathRangeSuffix(value: string): TargetParts {
  const match = /^(.*?)(:\d+(?:-\d+)?)$/.exec(value);
  if (!match) return { path: value, suffix: "" };
  return { path: match[1], suffix: match[2] };
}

function absolutePathPart(value: string): string | undefined {
  const normalized = normalizePathArg(value);
  const parts = splitPathRangeSuffix(normalized);
  return isAbsolute(parts.path) ? parts.path : undefined;
}

function scopedValue(value: string, repoRoot: string, omitRepoRoot: boolean): string {
  const normalized = normalizePathArg(value);
  const parts = splitPathRangeSuffix(normalized);
  if (!isAbsolute(parts.path)) return normalized;

  const scopedPath = relative(repoRoot, parts.path) || ".";
  const nextPath = omitRepoRoot && scopedPath === "." ? "." : scopedPath;
  return `${nextPath}${parts.suffix}`;
}

function sameRepoRoot(values: string[], fs: RepoRootFs): string | undefined {
  const roots = values.map((value) => findRepoRoot(value, fs));
  const root = roots[0];
  if (!root) return undefined;
  return roots.every((candidate) => candidate === root) ? root : undefined;
}

function asPathArray(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function pathFilterValue(paths: string[]): string | string[] | undefined {
  if (!paths.length) return undefined;
  return paths.length === 1 ? paths[0] : paths;
}

function absoluteFilterValues(value?: string | string[]): string[] {
  return asPathArray(value)
    .map((path) => absolutePathPart(path))
    .filter((path): path is string => Boolean(path));
}

function scopedFilterValue(value: string | string[] | undefined, repoRoot: string, omitRepoRoot: boolean): string | string[] | undefined {
  const scoped = asPathArray(value)
    .map((path) => {
      const normalized = normalizePathArg(path);
      const absolute = absolutePathPart(normalized);
      if (!absolute) return normalized;
      const scopedPath = relative(repoRoot, absolute) || ".";
      if (scopedPath.startsWith("..") || isAbsolute(scopedPath)) return normalized;
      return omitRepoRoot && scopedPath === "." ? undefined : scopedPath;
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
  const includeAbsolutes = absoluteFilterValues(options.path);
  const excludeAbsolutes = absoluteFilterValues(options.exclude);
  const filterAbsolutes = [...includeAbsolutes, ...excludeAbsolutes];

  if (options.targetRepoRoot) {
    for (const value of filterAbsolutes) {
      const filterRoot = findRepoRoot(value, fs);
      if (filterRoot && filterRoot !== options.targetRepoRoot) {
        throw new Error(`${options.errorPrefix ?? "Cymbal tool"} path filters resolve to a different repository than the target; split them into separate calls.`);
      }
    }
  }

  const includeRepoRoot = includeAbsolutes.length ? sameRepoRoot(includeAbsolutes, fs) : undefined;
  const repoRoot = options.targetRepoRoot ?? includeRepoRoot;
  if (!repoRoot) return { cwd, params };

  const withPath = options.applyPath(params, scopedFilterValue(options.path, repoRoot, true));
  const withExclude = options.applyExclude(withPath, scopedFilterValue(options.exclude, repoRoot, false));
  return { cwd: options.targetRepoRoot ? cwd : repoRoot, params: withExclude };
}

export function resolveSinglePathRun<Params>(
  params: Params,
  cwd: string,
  value: string | undefined,
  apply: (params: Params, value: string | undefined) => Params,
  options: { omitRepoRoot?: boolean; fs?: RepoRootFs } = {},
): ResolvedRun<Params> {
  if (!value) return { cwd, params };

  const fs = options.fs ?? defaultFs;
  const absolute = absolutePathPart(value);
  if (!absolute) return { cwd, params };

  const normalized = normalizePathArg(value);

  const repoRoot = findRepoRoot(absolute, fs);
  if (!repoRoot) return { cwd, params: apply(params, normalized) };

  return {
    cwd: repoRoot,
    params: apply(params, scopedValue(normalized, repoRoot, options.omitRepoRoot ?? false)),
  };
}

export function resolveMultiPathRun<Params>(
  params: Params,
  cwd: string,
  values: string[],
  apply: (params: Params, values: string[]) => Params,
  options: { omitRepoRoot?: boolean; fs?: RepoRootFs } = {},
): ResolvedRun<Params> {
  const absolutes = values.map(absolutePathPart).filter((value): value is string => Boolean(value));
  if (!absolutes.length) return { cwd, params };

  const normalized = values.map(normalizePathArg);

  const fs = options.fs ?? defaultFs;
  const repoRoot = sameRepoRoot(absolutes, fs);
  if (!repoRoot) return { cwd, params: apply(params, normalized) };

  return {
    cwd: repoRoot,
    params: apply(
      params,
      normalized.map((value) => scopedValue(value, repoRoot, options.omitRepoRoot ?? false)),
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
