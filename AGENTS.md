# pi-cymbal Agent Guidance

Use Cymbal first for local code navigation when the extension tools are available.

| Need | Tool |
| --- | --- |
| Repo overview | `cymbal_map` |
| Concise repo/module structure | `cymbal_structure` |
| Symbol or text search | `cymbal_search` |
| File structure | `cymbal_outline` |
| Read symbol or range | `cymbal_show` |
| References | `cymbal_refs` |
| Upstream impact | `cymbal_impact` |
| Import relationships | `cymbal_importers` |
| Implementation relationships | `cymbal_impls` |
| Diff-scoped impact — what my change affects | `cymbal_changed` only when available |
| Symbol-scoped diff review | `cymbal_diff` |
| Stale-index recovery or user-requested indexing | `cymbal_index` cautiously |
| One-call symbol investigation | `cymbal_investigate` only when available |
| Downward execution trace | `cymbal_trace` only when available |

Guidelines:

- Use `cymbal_map` or `cymbal_structure` first when the relevant area is unknown.
- Use `cymbal_search` before broad local grep.
- Use `cymbal_outline` before reading whole files.
- Use `cymbal_show` for targeted reads by symbol or line range.
- Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, or `cymbal_impls` before changing symbol relationships.
- Use `cymbal_diff` when reviewing changes to a specific local symbol.
- Use `cymbal_changed` to review what your current diff affects before refactors or PRs.
- Use `cymbal_index` only when a stale index is suspected or the user explicitly asks to refresh indexing; do not use it for routine navigation because Cymbal auto-indexes repositories.
- Use local `grep`, `find`, `ls`, and `read` only when Cymbal is unavailable or the repo is not indexable.
- Never use GitHub search tools for local repository searches.
