# pi-cymbal

Pi extension for Cymbal.

Cymbal is agent-native code navigation. It indexes code with tree-sitter and returns symbol, reference, import, and diff context for agents.

## Why this package?

Pi has file and shell tools. `pi-cymbal` adds Cymbal tools so agents can inspect indexed code before using broad grep, find, or read loops.

## Features

- Adds `cymbal_*` tools to Pi.
- Searches symbols and text through Cymbal's index.
- Reads symbols, files, and line ranges with `cymbal_show`.
- Inspects references, impacts, imports, implementations, and symbol diffs.
- Runs Cymbal nudges before eligible `bash`, `grep`, `find`, and `read` calls.
- Leaves original tool calls unchanged.

## Requirements

- Pi on Node.js `>=22.19.0`
- Cymbal `v0.15.0`. CI pins this version for the documented tool and flag surface. Other versions may expose a different command contract.
- Cymbal binary on `PATH`, or `CYMBAL_BIN` set

```sh
export CYMBAL_BIN=/absolute/path/to/cymbal
```

## Install

```sh
pi install npm:pi-cymbal
```

From GitHub:

```sh
pi install git:github.com/raphapr/pi-cymbal
```

Local development:

```sh
pi --no-extensions -e .
```

`--no-extensions` avoids conflicts with an already installed `pi-cymbal`.

## Quick start

```text
Use Cymbal to map this repo before editing.
```

```text
Find references to registerCymbalHooks with Cymbal.
```

## Available tools

| Need                           | Pi tool                           | Cymbal command                       |
| ------------------------------ | --------------------------------- | ------------------------------------ |
| Repo overview                  | `cymbal_map`                      | `cymbal ls [path] --stats`           |
| Indexed file inventory         | `cymbal_map` with `names: true`   | `cymbal ls --names [pattern]`        |
| Structural summary             | `cymbal_structure`                | `cymbal structure`                   |
| Symbol search                  | `cymbal_search`                   | `cymbal search <query>`              |
| Text search                    | `cymbal_search` with `text: true` | `cymbal search --text <query>`       |
| File outline                   | `cymbal_outline`                  | `cymbal outline <file>`              |
| Symbol, file, or range content | `cymbal_show`                     | `cymbal show <target>`               |
| References                     | `cymbal_refs`                     | `cymbal refs <symbol>`               |
| Upstream impact                | `cymbal_impact`                   | `cymbal impact <symbol>`             |
| Import relationships           | `cymbal_importers`                | `cymbal importers <file-or-package>` |
| Implementation relationships   | `cymbal_impls`                    | `cymbal impls <symbol>`              |
| Diff-scoped impact             | `cymbal_changed`                  | `cymbal changed`                     |
| Symbol diff                    | `cymbal_diff`                     | `cymbal diff <symbol> [base]`        |
| Explicit index refresh         | `cymbal_index`                    | `cymbal index [path]`                |
| Guided investigation           | `cymbal_investigate`              | `cymbal investigate <symbol>`        |
| Call trace                     | `cymbal_trace`                    | `cymbal trace <symbol>`              |
| Context bundle                 | `cymbal_context`                  | `cymbal context <symbol>`            |

## Common workflows

### Orient first

Use `cymbal_map` or `cymbal_structure` before editing unfamiliar code.

Useful params:

- `cymbal_map`: `path`, `depth`, `stats`, `repos`
- `cymbal_structure`: `limit`

### List indexed files

Use `cymbal_map` with `names: true` to list sorted, repo-relative code paths:

```json
{ "names": true, "pattern": "**/*.ts", "lang": "typescript", "format": "json" }
```

Omit `pattern` and `lang` for the full inventory. Patterns match substrings or globs with `**`, without brace expansion. Language names match those shown by `stats`. Names mode uses the current repository and cannot combine with `path`, `depth`, `stats`, or `repos`; `pattern` and `lang` require `names: true`.

The inventory includes only indexed files, after skip rules. Use Pi's `find` for exact filesystem globs, non-code files, or files excluded from the index. Empty JSON inventories return `results: []`.

### Search and read narrowly

Use `cymbal_search`, `cymbal_outline`, and `cymbal_show` instead of broad grep/read loops.

### Check relationships before refactors

Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, and `cymbal_impls` before changing exported symbols or imports.

### Review what your diff affects

Use `cymbal_changed` to see the changed symbols of your current git diff plus their references and transitive impact in one call, before refactors or PRs. Scope it with `staged` (staged changes) or `base` (diff against a git ref); the two cannot be combined. Tune the blast radius with `depth`, `limit`, `maxSymbols`, `maxImpact`, `noTests`, `testPath`, and `resolveScope`.

### Cross-language and blast-radius params

- `resolveScope` (`same` | `family` | `all`, default `family`) on `cymbal_impact`, `cymbal_trace`, `cymbal_investigate`, and `cymbal_changed` constrains cross-language name resolution.
- `noTests` on `cymbal_impact` and `cymbal_changed` excludes callers in test files from the impact set. Impact graphs also hide test callers but retain reachable production callers through indirect edges.
- `testPath` on these tools adds test-path patterns to the built-in conventions, for example `{"testPath": ["qa/", "**/*_it.go"]}`. Patterns use substring or glob-with-`**` matching, without brace expansion. They affect production/test splits and reference counts even without `noTests`.
- `includeUnresolved` keeps unresolved targets that are otherwise filtered out: on `cymbal_trace` it affects text, JSON, and graph output; on `cymbal_impact` it adds unresolved nodes to the graph output.
- `graph`, `graphFormat` (`mermaid` | `dot` | `json`), and `graphLimit` on `cymbal_impact` and `cymbal_trace` render call graphs, matching `cymbal_importers` and `cymbal_impls`.

### JSON compatibility in v0.15.0

pi-cymbal preserves the CLI's JSON payloads. Single-symbol trace and impact payloads remain object-shaped.

**Breaking change:** `cymbal_investigate` now uses the same envelope for single and batch requests. Iterate `payload.results.results`; each entry has a `symbol` and either a `result` or an `error`. The single-result path changes from `payload.results.result` to `payload.results.results[0].result`; batch entries move from `payload.results[]` to `payload.results.results[]`. The outer `version` remains `"0.1"`, so it cannot distinguish the old and new shapes.

Empty `cymbal_changed` payloads now contain `results.results: []`, not `null`. Graph output can include `edges_truncated: true` and edges marked `indirect: true`. Changed output can include `conflicted_files`. Inspect these fields before treating the output as a complete impact report. See the [Cymbal v0.15.0 release notes](https://github.com/1broseidon/cymbal/releases/tag/v0.15.0).

### Review diffs by symbol

Use `cymbal_diff` for a focused diff on one symbol.

### Refresh the index only when needed

Use `cymbal_index` only when the index looks stale or the user asks to refresh it. Cymbal auto-indexes during normal navigation.

## Agent nudges

At session start, pi-cymbal runs:

```sh
cymbal hook remind --format=text --update=if-stale
```

Before eligible `bash`, `grep`, `find`, and `read` calls, it runs:

```sh
cymbal hook nudge --format=json
```

Nudges do not block. They are hidden from TUI output. Pi may show them as notifications. Duplicate nudges are suppressed per cwd for 60s. `Read` and `Glob` suppress per tool.

Glob nudges preserve the original pattern in `cymbal ls --names` suggestions. Explicit `find.path` roots other than `.` suppress the nudge. Brace patterns suggest the unfiltered inventory because Cymbal does not expand braces.

### Guidance configuration

Set guidance globally in `~/.pi/agent/extensions/pi-cymbal.json` or per project in `.pi/pi-cymbal.json`:

```json
{
  "systemPrompt": false,
  "nudges": false
}
```

Both options default to `true`. Project settings override global settings. pi-cymbal ignores project settings for untrusted projects and suppresses both features whenever no `cymbal_*` tools are active.

Change guidance for the current session with `/cymbal`:

```text
/cymbal
/cymbal off
/cymbal system-prompt on
/cymbal nudges off
```

Runtime changes last until the next session and do not modify either configuration file.

## Paths and Repos

pi-cymbal relies on Cymbal's Git repo auto-detection.

For non-Git directories, use Pi file tools such as `find`, `grep`, `ls`, and `read`.

## Output

Tools default to Cymbal's agent-native text output.

Pass `format: "json"` for JSON:

```text
Use cymbal_search with format json to find registerCymbalHooks.
```

Large outputs use bounded in-memory previews. Tool details include a session-managed temp-file path with the full output. Pi removes managed spill files on session shutdown. Cancellation terminates the Cymbal process tree before returning control.

## Development

```fish
npm install
npm run validate

# Require the real pinned CLI smoke locally when Cymbal v0.15.0 is installed
env REQUIRE_CYMBAL=1 CYMBAL_BIN=(command -v cymbal) \
  node --import tsx --test test/cli-smoke.test.mjs
```

Local Pi smoke:

```sh
pi --no-extensions -e . --no-session -p \
  "Use cymbal_structure to orient in this repo, then use cymbal_diff on registerCymbalHooks."
```

## Build

The published extension entry is a single bundled `dist/index.ts`, produced by `npm run build` (run automatically by `pretest` and `prepack`). Bundling `src/` into one file cuts Pi's startup module-load cost by ~75% versus loading the multi-file source graph.

The bundle is emitted as `.ts`, not `.js`, on purpose. Pi's loader runs extensions through jiti with `tryNative`: a `.js` entry loads natively and resolves `@earendil-works/*` from disk (a second framework copy, ~950ms), while a `.ts` entry keeps the jiti path that aliases the framework to Pi's already-loaded copies. Framework packages and `typebox` are kept external for the same reason. Do not switch the entry to `.js`.

## Publishing

1. Bump `package.json` version.
2. Create a GitHub release with a matching tag, such as `vX.Y.Z`.
3. GitHub Actions validates and publishes with npm provenance.

Use the manual `Publish to npm` workflow with `dry_run: true` to test packaging. Every live publish must run from the exact `v<package-version>` tag and fails closed if npm version availability cannot be verified.

## License

MIT
