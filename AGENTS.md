# pi-cymbal Agent Guidance

Use Cymbal first for local code navigation when the extension tools are available.

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
| One-call symbol investigation | `cymbal_investigate` only when available |
| Downward execution trace | `cymbal_trace` only when available |

Guidelines:

- Use `cymbal_map` first when the relevant area is unknown.
- Use `cymbal_search` before broad local grep.
- Use `cymbal_outline` before reading whole files.
- Use `cymbal_show` for targeted reads by symbol or line range.
- Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, or `cymbal_impls` before changing symbol relationships.
- Use local `grep`, `find`, `ls`, and `read` only when Cymbal is unavailable or the repo is not indexable.
- Never use GitHub search tools for local repository searches.
