# src/core

## Responsibility

Core repository-analysis logic for RepoGuide. This folder provides Git inspection, repo-path normalization, `.guideignore` filtering, folder tree construction, guide freshness/staleness checks, execution planning, token estimates, and shared typed errors. Code here is mostly pure utility logic used by higher-level command/UI layers.

## Important Files

- `src/core/errors.ts`: Defines `RepoGuideError`, including process-oriented `exitCode`, plus `isRepoGuideError`.
- `src/core/git.ts`: Wraps Git commands for repository discovery, tracked entry listing, commit lookup, staged/unstaged diffs, range diffs, rename/delete parsing, mode-only detection, and newline-path rejection.
- `src/core/paths.ts`: Central repo-relative path utilities, including normalization, folder ancestry, guide path construction, descendant checks, and repo-root absolute path conversion.
- `src/core/guideignore.ts`: Loads `.guideignore`, applies default exclusions for `guide.md` files and `.guideignore`, and filters source files.
- `src/core/tree.ts`: Builds deterministic `FolderTree` / `FolderNode` structures from eligible source files and tracked guide files.
- `src/core/plans.ts`: Builds `RepoContext` and computes init/check/update folder plans from the folder tree.
- `src/core/stale.ts`: Determines whether folder guides are missing or stale based on Git history, direct source changes, descendant guide changes, and uncommitted guide edits.
- `src/core/token-estimate.ts`: Provides approximate input token estimation and reserved output token budgeting.
- `src/core/*.test.ts`: Vitest coverage for Git edge cases, ignore behavior, path handling, tree ordering, freshness logic, and token estimation.

## Child Modules

None.

## Notes

- Paths passed through this layer should be repo-relative POSIX-style paths; use `normalizeRepoPath` from `src/core/paths.ts` before storing or comparing paths.
- `src/core/git.ts` intentionally treats submodules as opaque Git entries and does not recurse into them.
- Git paths containing newlines are unsupported and should raise `RepoGuideError`.
- Mode-only changes are intentionally ignored for guide freshness in `src/core/stale.ts`.
- `src/core/guideignore.ts` always excludes guide files and `.guideignore` from source-file consideration, even when no `.guideignore` file exists.
- Folder guide freshness is based on the latest guide commit plus committed and working-tree changes since then.
