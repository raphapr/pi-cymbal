# pi-cymbal Agent Guidance

Use Cymbal first for local code navigation when the extension tools are available.

| Need                                            | Tool                                     |
| ----------------------------------------------- | ---------------------------------------- |
| Repo overview                                   | `cymbal_map`                             |
| Indexed code-file inventory                     | `cymbal_map` with `names: true`          |
| Concise repo/module structure                   | `cymbal_structure`                       |
| Symbol or text search                           | `cymbal_search`                          |
| File structure                                  | `cymbal_outline`                         |
| Read symbol or range                            | `cymbal_show`                            |
| References                                      | `cymbal_refs`                            |
| Upstream impact                                 | `cymbal_impact`                          |
| Import relationships                            | `cymbal_importers`                       |
| Implementation relationships                    | `cymbal_impls`                           |
| Diff-scoped impact — what my change affects     | `cymbal_changed` only when available     |
| Symbol-scoped diff review                       | `cymbal_diff`                            |
| Stale-index recovery or user-requested indexing | `cymbal_index` cautiously                |
| One-call symbol investigation                   | `cymbal_investigate` only when available |
| Downward execution trace                        | `cymbal_trace` only when available       |
| Focused context bundle                          | `cymbal_context` only when available     |

Guidelines:

- Use `cymbal_map` or `cymbal_structure` first when the relevant area is unknown.
- Use `cymbal_map` with `names: true` and optional `pattern`/`lang` for indexed code files. Do not combine names mode with `path`, `depth`, `stats`, or `repos`. Patterns support substrings and globs with `**`, not brace expansion.
- Use `cymbal_search` before broad local grep.
- Use `cymbal_outline` before reading whole files.
- Use `cymbal_show` for targeted reads by symbol or line range.
- Use `cymbal_refs`, `cymbal_impact`, `cymbal_importers`, or `cymbal_impls` before changing symbol relationships.
- Use `cymbal_diff` when reviewing changes to a specific local symbol.
- Use `cymbal_changed` to review what your current diff affects before refactors or PRs.
- Use `testPath` on `cymbal_impact` or `cymbal_changed` to add repo-specific test patterns. These affect classification and counts even without `noTests`; impact graphs with `noTests` retain production callers through indirect edges.
- With Cymbal v0.15.0, iterate `cymbal_investigate` JSON at `results.results[]` for single and batch requests. Read each entry's `symbol` and `result` or `error`.
- Check native JSON completeness fields such as `edges_truncated` and `conflicted_files`. Empty `cymbal_changed` JSON uses a nested `results: []`.
- Use `cymbal_context` for a focused symbol bundle when supported by the installed Cymbal version.
- Use `cymbal_index` only when a stale index is suspected or the user explicitly asks to refresh indexing; do not use it for routine navigation because Cymbal auto-indexes repositories.
- Use local `grep`, `find`, `ls`, and `read` when Cymbal is unavailable, the repo is not indexable, or the task needs exact filesystem globs, non-code files, or files excluded from the index.
- Never use GitHub search tools for local repository searches.
