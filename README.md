# pi-cymbal

`pi-cymbal` is a [Pi](https://pi.dev) extension for Cymbal code navigation. It exposes symbol search, references, impact analysis, and context commands as Pi tools. It also nudges agents away from slow shell searches when Cymbal fits.

## What It Does

### Agent Tools

For each `cymbal_*` tool call, the extension:

1. Finds the `cymbal` binary from `CYMBAL_BIN`, `~/.local/bin/cymbal`, or `PATH`.
2. Builds the Cymbal CLI command with safe argument arrays.
3. Runs Cymbal with deterministic output settings.
4. Returns agent-native output by default.
5. Adds command metadata to `details`.

### Session Start

At `session_start`, pi-cymbal runs:

```sh
cymbal hook remind --format=text --update=if-stale
```

It caches the reminder and injects it before agent turns. Missing Cymbal or hook failures do not block Pi startup.

### Bash Tool Nudges

Before `bash` tool calls, pi-cymbal sends the shell command to:

```sh
cymbal hook nudge --format=json
```

If Cymbal suggests a better navigation command, Pi receives guidance. The original bash command still runs.

## Requirements

- Pi
- A working `cymbal` binary.

Install Cymbal from the official docs. Put `cymbal` on `PATH`, or set `CYMBAL_BIN`:

```sh
export CYMBAL_BIN=/absolute/path/to/cymbal
```

## Install

From NPM:

```sh
pi install npm:pi-cymbal
```

From GitHub:

```sh
pi install git:github.com/raphapr/pi-cymbal
```

For local development:

```sh
pi -e /home/raphael/repos/github.com/raphapr/pi-cymbal
```

## Quick Start

Ask Pi to use Cymbal:

```text
Use Cymbal to map this repo before editing.
```

```text
Find references to registerCymbalHooks with Cymbal.
```

```text
Show the implementation of cymbalExtension.
```

Tool prompts, session reminders, and bash nudges steer agents toward Cymbal when it fits.

## Repository and Path Scope

Indexed Cymbal commands work best from a Git repository. For absolute paths inside another Git repo, pi-cymbal changes the Cymbal cwd to that repo root and passes repo-relative paths. This applies to `cymbal_map`, `cymbal_search` path filters, `cymbal_show`, `cymbal_outline`, and `cymbal_importers`.

pi-cymbal relies on Cymbal's Git repo auto-detection and does not pass `--db`. Cymbal can still handle some absolute path reads outside a Git cwd. For non-Git directories, use Pi file tools such as `find`, `grep`, `ls`, and `read` when Cymbal reports that no repo was detected.

## Tools

| Need                           | Pi tool                           | Cymbal command                       |
| ------------------------------ | --------------------------------- | ------------------------------------ |
| Repo overview                  | `cymbal_map`                      | `cymbal ls [path] --stats`           |
| Symbol search                  | `cymbal_search`                   | `cymbal search <query>`              |
| Text search                    | `cymbal_search` with `text: true` | `cymbal search --text <query>`       |
| File outline                   | `cymbal_outline`                  | `cymbal outline <file>`              |
| Symbol, file, or range content | `cymbal_show`                     | `cymbal show <target>`               |
| References                     | `cymbal_refs`                     | `cymbal refs <symbol>`               |
| Upstream impact                | `cymbal_impact`                   | `cymbal impact <symbol>`             |
| Import relationships           | `cymbal_importers`                | `cymbal importers <file-or-package>` |
| Implementation relationships   | `cymbal_impls`                    | `cymbal impls <symbol>`              |
| Guided investigation           | `cymbal_investigate`              | `cymbal investigate <symbol>`        |
| Call trace                     | `cymbal_trace`                    | `cymbal trace <symbol>`              |
| Context bundle                 | `cymbal_context`                  | `cymbal context <symbol>`            |

Optional tools check command support first. If Cymbal lacks a guide-only command, the tool returns an unsupported-command error.

## Tool Details

### `cymbal_map`

Use for repo or directory orientation before choosing files.

Common parameters:

- `path`: directory scope. Defaults to `.`.
- `depth`: tree depth.
- `stats`: include repository stats. Defaults to `true`.
- `repos`: list indexed repositories instead of a tree.

### `cymbal_search`

Use for symbol or text search.

Common parameters:

- `query`: symbol query, or text query when `text` is true.
- `queries`: additional symbol queries. In text mode, Cymbal treats them as more words in the same pattern.
- `text`: use Cymbal full-text search.
- `exact`, `kind`, `lang`, `limit`: filters.
- `path`, `exclude`: include or exclude path globs.

### `cymbal_outline`

Use before reading full files. pi-cymbal runs one outline command per file because Cymbal accepts one file per call. Files with no outline symbols produce partial output when other files succeed.

### `cymbal_show`

Use for targeted reads. Targets can be symbols, files, or ranges such as `src/index.ts:1-40`. Pass `targets` to read several targets in one call. Missing targets produce partial output when other targets succeed. Split JSON calls when absolute targets point at a different repo than relative or symbol targets, or when absolute targets span repos.

### Relationship Tools

Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, and `cymbal_impls` before refactors. Use `graph`, `graphFormat`, and `graphLimit` where Cymbal supports graph output.

## Output Format

Tools default to Cymbal's compact agent-native output.

Pass `format: "json"` to request machine-readable output:

```text
Use cymbal_search with format json to find registerCymbalHooks.
```

Large outputs are truncated. Tool details include a temp-file path with the full output.

Recoverable misses such as "no results found" and "file not found" return normal tool results with `details.status = "not_found"`. Path-like misses include nearby file suggestions when pi-cymbal can find them. Repository-boundary errors remain errors.

## Environment Variables

- `CYMBAL_BIN`: absolute path to the Cymbal binary.
- `CYMBAL_NO_UPDATE_NOTIFIER`: set by the extension for deterministic tool output.
- `NO_COLOR`: set by the extension for deterministic tool output.
- `TERM`: set to `dumb` by the extension for deterministic tool output.

## Development

```sh
npm install
npm run typecheck
npm test
npm pack --dry-run
```

Run full validation:

```sh
npm run validate
```

Try it through Pi:

```sh
pi -e /home/raphael/repos/github.com/raphapr/pi-cymbal \
  --tools cymbal_map,cymbal_search,cymbal_outline,cymbal_show \
  -p "Use Cymbal to map this package."
```

## Publishing

GitHub Actions publishes releases:

1. Configure npm trusted publishing for `pi-cymbal` and allow `.github/workflows/publish.yml` from this repository.
2. Bump `package.json` version.
3. Create a GitHub release whose tag matches the version, such as `v0.1.0`.
4. The publish workflow runs validation and publishes with npm provenance.

Use the manual `Publish to npm` workflow with `dry_run: true` to test packaging.

## License

MIT
