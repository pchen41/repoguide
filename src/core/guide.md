# src/core

## Responsibility

`src/core` contains the repository-modeling and change-detection primitives used by the CLI/workflow layers. It is intentionally concerned with deterministic local state, not prompt construction or provider I/O.

The core flow is:

1. Discover Git state with `src/core/git.ts`.
2. Normalize all paths into repo-relative POSIX paths with `src/core/paths.ts`.
3. Apply `.guideignore` and built-in exclusions with `src/core/guideignore.ts`.
4. Build a folder tree of guide candidates with `src/core/tree.ts`.
5. Build command-specific work plans with `src/core/plans.ts`.
6. Decide whether guides are missing or stale with `src/core/stale.ts`.

The main data contract is that repo paths crossing module boundaries are normalized, repo-relative, forward-slash paths, with `.` representing the repository root. Core code should not pass absolute paths around except at the filesystem boundary.

## Important Files

- `src/core/plans.ts` is the main orchestration layer for core state. `buildRepoContext()` combines tracked Git entries, `.guideignore` filtering, and folder-tree construction. `initPlan()`, `checkPlan()`, and `updatePlan()` encode command behavior and ordering, so behavior changes for which folders are processed usually belong here rather than in CLI code.

- `src/core/git.ts` wraps all Git shell-outs and defines the parsed `GitEntry` / `GitChange` contracts consumed elsewhere. It deliberately uses NUL-delimited Git output where possible, treats submodules as opaque `160000` gitlinks, and rejects paths containing newlines. It also distinguishes content modifications from mode-only changes by pairing `--name-status` with `--numstat`; stale detection depends on the synthetic `mode-only` status.

- `src/core/stale.ts` decides whether a folder guide needs attention. A guide is stale when direct source files in that folder changed since the guide’s last commit, when descendant guides changed, or when extra guide paths were updated during the current run. It intentionally ignores mode-only changes and `.guideignore`-ignored source changes.

- `src/core/tree.ts` builds the `FolderTree` from eligible source files plus existing guide files. Existing guide folders are retained even when they currently have no eligible source files, which lets checks/update flows reason about stale or orphaned guides.

- `src/core/paths.ts` is the path invariant layer. Use these helpers instead of ad hoc `path.join` / string slicing when crossing module boundaries. `normalizeRepoPath()` rejects paths escaping the repo and normalizes root to `.`.

- `src/core/guideignore.ts` implements `.guideignore` behavior and built-in exclusions. `guide.md` files and `.guideignore` itself are never considered source files, regardless of user patterns.

## Child Modules

None.

## Notes

- Do not introduce newline-containing path support casually. `src/core/git.ts` currently rejects such paths explicitly because several downstream parsers and human-facing guide workflows assume one logical repo path per string.

- Stale detection is based on the guide file’s latest commit. If a guide exists only in the working tree and has no Git history, it is considered stale with reason `guide has no Git history`.

- `freshnessForFolder()` only considers direct source changes for the folder being checked, not arbitrary descendant source changes. Parent guides are invalidated by descendant guide changes, not by descendant source changes directly. This keeps the workflow bottom-up: child guides absorb local source changes, then parent guides update based on changed child guides.

- `buildRepoContext()` filters source files before building the tree, but passes all tracked entries to `buildFolderTree()` so existing guides remain visible even if their folder has no current eligible source files.

- `repoRelativeFolder()` resolves both repo root and cwd through native realpaths before computing the relative path. Preserve this behavior to avoid symlink-related command-scope bugs.

- `diffNameStatus()`, `stagedChanges()`, and `unstagedChanges()` intentionally return empty results on failure/empty history in some cases through `allowFailure`. Callers should treat an empty change list as “no actionable Git diff,” not necessarily proof that Git commands all succeeded.

- Tests in this folder use real temporary Git repositories. When changing Git parsing, path normalization, guide ignore semantics, or stale reasons, update the corresponding `*.test.ts` fixtures rather than replacing them with mocks; the behavior depends on actual Git output formats.
