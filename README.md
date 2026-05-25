# pi-cymbal

Pi extension for Cymbal code navigation.

It adds `cymbal_*` tools to Pi so agents can search symbols, read focused code, inspect references, and review symbol-scoped diffs without falling back to broad shell commands.

## Requirements

- Pi
- `cymbal` on `PATH`, or `CYMBAL_BIN` set
- Cymbal `v0.13.5+` for the full tool set

```sh
export CYMBAL_BIN=/absolute/path/to/cymbal
```

Older Cymbal versions may still support the original navigation tools. `structure`, `diff`, `index`, and newer flags need `v0.13.5+`.

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
pi --no-extensions -e /home/raphael/repos/github.com/raphapr/pi-cymbal
```

`--no-extensions` avoids conflicts with an already installed `pi-cymbal`.

## Quick Start

```text
Use Cymbal to map this repo before editing.
```

```text
Find references to registerCymbalHooks with Cymbal.
```

```text
Show the implementation of cymbalExtension.
```

## Tools

| Need                           | Pi tool                           | Cymbal command                       |
| ------------------------------ | --------------------------------- | ------------------------------------ |
| Repo overview                  | `cymbal_map`                      | `cymbal ls [path] --stats`           |
| Structural summary             | `cymbal_structure`                | `cymbal structure`                   |
| Symbol search                  | `cymbal_search`                   | `cymbal search <query>`              |
| Text search                    | `cymbal_search` with `text: true` | `cymbal search --text <query>`       |
| File outline                   | `cymbal_outline`                  | `cymbal outline <file>`              |
| Symbol, file, or range content | `cymbal_show`                     | `cymbal show <target>`               |
| References                     | `cymbal_refs`                     | `cymbal refs <symbol>`               |
| Upstream impact                | `cymbal_impact`                   | `cymbal impact <symbol>`             |
| Import relationships           | `cymbal_importers`                | `cymbal importers <file-or-package>` |
| Implementation relationships   | `cymbal_impls`                    | `cymbal impls <symbol>`              |
| Symbol diff                    | `cymbal_diff`                     | `cymbal diff <symbol> [base]`        |
| Explicit index refresh         | `cymbal_index`                    | `cymbal index [path]`                |
| Guided investigation           | `cymbal_investigate`              | `cymbal investigate <symbol>`        |
| Call trace                     | `cymbal_trace`                    | `cymbal trace <symbol>`              |
| Context bundle                 | `cymbal_context`                  | `cymbal context <symbol>`            |

Newer Cymbal commands check support first. If the installed Cymbal version lacks a command, the tool returns an unsupported-command error.

## Common Usage

### Orient first

Use `cymbal_map` or `cymbal_structure` before editing unfamiliar code.

Useful params:

- `cymbal_map`: `path`, `depth`, `stats`, `repos`
- `cymbal_structure`: `limit`

### Search and read narrowly

Use `cymbal_search`, `cymbal_outline`, and `cymbal_show` instead of broad grep/read loops.

Useful params:

- `cymbal_search`: `query`, `queries`, `text`, `exact`, `ignoreCase`, `kind`, `lang`, `limit`, `path`, `exclude`
- `cymbal_outline`: `files`, `names`, `signatures`
- `cymbal_show`: `target`, `targets`, `all`, `context`, `path`, `exclude`

`ignoreCase` implies exact symbol matching and cannot be used with text search.

### Check relationships before refactors

Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, and `cymbal_impls` before changing exported symbols or imports.

Useful params:

- `cymbal_refs`: `symbol`, `symbols`, `context`, `file`, `path`, `exclude`, `importers`, `impact`, `depth`, `limit`
- `cymbal_impact`: `symbol`, `symbols`, `context`, `depth`, `limit`
- `cymbal_importers`: `target`, `depth`, `includeUnresolved`, graph options
- `cymbal_impls`: `symbol`, `symbols`, `of`, `lang`, `path`, `exclude`, `resolved`, `unresolved`, `includeUnresolved`, graph options

### Review diffs by symbol

Use `cymbal_diff` for a focused diff on one symbol.

Useful params:

- `symbol`: symbol to diff
- `base`: Git base revision
- `stat`: show diffstat instead of full diff

### Refresh the index only when needed

Use `cymbal_index` only when the index looks stale or the user asks to refresh it. Cymbal auto-indexes during normal navigation.

Useful params:

- `path`, `force`, `workers`, `exclude`, `includeGenerated`, `includeLargeFiles`

## Hooks

At session start, pi-cymbal runs:

```sh
cymbal hook remind --format=text --update=if-stale
```

Before eligible `bash` and `grep` calls, it runs:

```sh
cymbal hook nudge --format=json
```

Nudges are advisory. The original tool still runs. Identical suggestions are suppressed for 60 seconds per cwd.

## Paths and Repos

pi-cymbal relies on Cymbal's Git repo auto-detection. It does not pass `--db`.

For absolute paths inside a Git repo, pi-cymbal runs Cymbal from that repo root and passes repo-relative paths. This applies to:

- path targets for `cymbal_map`, `cymbal_show`, `cymbal_outline`, `cymbal_importers`, and `cymbal_index`
- include `path` filters for `cymbal_search`, `cymbal_show`, `cymbal_refs`, and `cymbal_impls`

Absolute `exclude` filters are scoped after a target or include `path` selects a repo.

For non-Git directories, use Pi file tools such as `find`, `grep`, `ls`, and `read`.

## Output

Tools default to Cymbal's agent-native text output.

Pass `format: "json"` for JSON:

```text
Use cymbal_search with format json to find registerCymbalHooks.
```

Large outputs are truncated. Tool details include a temp-file path with the full output.

Recoverable misses such as "no results found" and "file not found" return normal tool results with `details.status = "not_found"`. Repository-boundary errors remain errors.

## Development

```sh
npm install
npm run validate
```

Local Pi smoke:

```sh
pi --no-extensions -e . --no-session -p \
  "Use cymbal_structure to orient in this repo, then use cymbal_diff on registerCymbalHooks."
```

## Publishing

1. Bump `package.json` version.
2. Create a GitHub release with a matching tag, such as `vX.Y.Z`.
3. GitHub Actions validates and publishes with npm provenance.

Use the manual `Publish to npm` workflow with `dry_run: true` to test packaging.

## License

MIT
