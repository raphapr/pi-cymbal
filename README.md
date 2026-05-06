# pi-cymbal

Pi extension exposing Cymbal as an agent-native code navigation layer.

## Features

- Cymbal-native tools for map, search, outline, show, refs, impact, importers, and impls.
- Agent-native frontmatter output by default.
- Optional JSON output per tool.
- Pi-native reminder and nudge hooks inspired by Cymbal's OpenCode plugin.

## Requirements

Install `cymbal` and ensure it is available through `CYMBAL_BIN`, `~/.local/bin/cymbal`, or `PATH`.

## Install

```sh
pi install git:github.com/raphapr/pi-cymbal
```

For local development:

```sh
pi -e /home/raphael/repos/github.com/raphapr/pi-cymbal
```

## Tools

| Need | Tool |
| --- | --- |
| Repo overview | `cymbal_map` |
| Symbol or text search | `cymbal_search` |
| File structure | `cymbal_outline` |
| Read symbol or range | `cymbal_show` |
| References | `cymbal_refs` |
| Upstream impact | `cymbal_impact` |
| Import relationships | `cymbal_importers` |
| Implementation relationships | `cymbal_impls` |

Optional guide-only tools are registered with capability checks: `cymbal_investigate`, `cymbal_trace`, and `cymbal_context`.

## Output format

Tools default to Cymbal's agent-native frontmatter output. Pass `format: "json"` to request `--json` output.

## Hooks

The extension runs `cymbal hook remind --format=text --update=if-stale` at session start and injects the cached guidance before agent turns.

The extension also inspects bash tool calls with `cymbal hook nudge --format=json`. Nudges never block the original bash command.

## Publishing

Pi discovers public packages through npm metadata. The package must be published to npm with the `pi-package` keyword. After npm indexing, it appears on `https://pi.dev/packages` and can be installed with:

```sh
pi install npm:pi-cymbal
```

Releases publish through GitHub Actions:

1. Configure npm trusted publishing for `pi-cymbal` and allow `.github/workflows/publish.yml` from this repository.
2. Bump `package.json` version.
3. Create a GitHub release whose tag matches the version, such as `v0.1.0`.
4. The publish workflow runs validation and publishes with npm provenance.

Use the manual `Publish to npm` workflow with `dry_run: true` to test packaging without publishing.

## Development

```sh
npm install
npm run typecheck
npm test
npm pack --dry-run
```
