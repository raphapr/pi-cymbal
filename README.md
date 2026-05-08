# pi-cymbal

`pi-cymbal` is a [Pi](https://pi.dev) extension that adds a Cymbal-powered code navigation to Pi. It exposes Cymbal's symbol index, references, impact analysis, and context commands as Pi tools, then nudges agents away from slow shell searches when Cymbal can answer faster.

## What It Does

### Agent Tools

When the agent calls a `cymbal_*` tool, the extension:

1. Resolves the `cymbal` binary from `CYMBAL_BIN`, `~/.local/bin/cymbal`, or `PATH`.
2. Builds the matching Cymbal CLI command with safe argument arrays.
3. Runs Cymbal with deterministic agent output settings.
4. Returns Cymbal's agent-native frontmatter output by default.
5. Includes command metadata in `details` for debugging and traceability.

### Session Start

At `session_start`, pi-cymbal runs:

```sh
cymbal hook remind --format=text --update=if-stale
```

It caches the reminder and injects it before agent turns. The hook is best-effort. Missing Cymbal or hook failures do not block Pi startup.

### Bash Tool Nudges

Before `bash` tool calls, pi-cymbal sends the shell command to:

```sh
cymbal hook nudge --format=json
```

If Cymbal suggests a better navigation command, Pi receives a non-blocking guidance message. The original bash command still runs.

## Requirements

- Pi
- A working `cymbal` binary.

Install Cymbal from the official docs, then make it available as `cymbal` on your `PATH` or set `CYMBAL_BIN` to the absolute path of the binary:

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

Ask Pi for local code navigation in plain language:

```text
Use Cymbal to map this repo before editing.
```

```text
Find references to registerCymbalHooks with Cymbal.
```

```text
Show the implementation of cymbalExtension.
```

The model decides when to call tools, but the package adds tool guidance, session reminders, and bash nudges to make Cymbal the default path for local code understanding.

## Non-Git Directories

`pi-cymbal` expects Pi's current working directory to be inside a Git repository. Cymbal can index arbitrary directories with `cymbal index <path>`, but this extension intentionally relies on Cymbal's Git repo auto-detection and does not pass `--db`.

For non-Git directories, use Pi's local file tools such as `find`, `grep`, `ls`, and `read`, or start Pi from inside a Git repository.

## Tools

| Need                           | Pi tool                           | Cymbal command                       |
| ------------------------------ | --------------------------------- | ------------------------------------ |
| Repo overview                  | `cymbal_map`                      | `cymbal ls [path] --stats`           |
| Symbol search                  | `cymbal_search`                   | `cymbal search <query>`              |
| Text search                    | `cymbal_search` with `text: true` | `cymbal search --text <query>`       |
| File outline                   | `cymbal_outline`                  | `cymbal outline <file>`              |
| Symbol, file, or range content | `cymbal_show`                     | `cymbal show <target>`               |
| References                     | `cymbal_refs`                     | `cymbal refs <symbol>`               |
| Upstream impact                | `cymbal_impact`                   | `cymbal refs <symbol> --impact`      |
| Import relationships           | `cymbal_importers`                | `cymbal importers <file-or-package>` |
| Implementation relationships   | `cymbal_impls`                    | `cymbal impls <symbol>`              |
| Guided investigation           | `cymbal_investigate`              | `cymbal investigate <symbol>`        |
| Call trace                     | `cymbal_trace`                    | `cymbal trace <symbol>`              |
| Context bundle                 | `cymbal_context`                  | `cymbal context <symbol>`            |

The optional tools run capability checks first. If your installed Cymbal version does not support a guide-only command, the tool returns a clear unsupported-command error.

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
- `queries`: additional symbol queries.
- `text`: use Cymbal full-text search.
- `exact`, `kind`, `lang`, `limit`: filters.
- `path`, `exclude`: include or exclude path globs.

### `cymbal_outline`

Use before reading full files. The Pi tool accepts multiple files. Cymbal currently accepts one file per CLI call, so pi-cymbal runs one command per file and combines the output.

### `cymbal_show`

Use for targeted reads. Targets can be symbols, files, or ranges such as `src/index.ts:1-40`.

### Relationship Tools

Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, and `cymbal_impls` before refactors. Graph output is available where Cymbal supports it through `graph`, `graphFormat`, and `graphLimit`.

## Output Format

Tools default to Cymbal's agent-native output because it is compact and readable by models.

Pass `format: "json"` to request machine-readable output:

```text
Use cymbal_search with format json to find registerCymbalHooks.
```

Large outputs are truncated before returning to the model. When truncation happens, the full output is written to a temp file and the path is included in tool details.

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

Run the full local validation suite:

```sh
npm run validate
```

Try the package through Pi:

```sh
pi -e /home/raphael/repos/github.com/raphapr/pi-cymbal \
  --tools cymbal_map,cymbal_search,cymbal_outline,cymbal_show \
  -p "Use Cymbal to map this package."
```

## Publishing

Releases publish through GitHub Actions:

1. Configure npm trusted publishing for `pi-cymbal` and allow `.github/workflows/publish.yml` from this repository.
2. Bump `package.json` version.
3. Create a GitHub release whose tag matches the version, such as `v0.1.0`.
4. The publish workflow runs validation and publishes with npm provenance.

Use the manual `Publish to npm` workflow with `dry_run: true` to test packaging without publishing.

## License

MIT
