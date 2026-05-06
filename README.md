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

## Development

```sh
npm install
npm run typecheck
npm test
npm pack --dry-run
```
