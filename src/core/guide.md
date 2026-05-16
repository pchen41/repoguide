# src/core

## How This Fits

`src/core` contains the repository-analysis primitives used by the CLI/workflow layers to decide which folders need `guide.md` files, which existing guides are stale, and in what order guide work should happen. It is intentionally mostly side-effect-light except for Git/filesystem boundaries:

- Git state is read through `src/core/git.ts`.
- Repo-relative path semantics are centralized in `src/core/paths.ts`.
- `.guideignore` filtering is applied by `src/core/guideignore.ts`.
- Folder guide candidates are modeled by `src/core/tree.ts`.
- Command-level folder plans are assembled in `src/core/plans.ts`.
- Staleness/freshness decisions live in `src/core/stale.ts`.

Code outside this folder should prefer these APIs over shelling out to Git or hand-normalizing paths, because the details here encode repo-specific behavior around `guide.md`, submodules, ignored files, and mode-only changes.

## Core Contracts and Invariants

### Repo paths are POSIX-style and cannot escape the repo

All repo-relative paths should flow through `normalizeRepoPath` from `src/core/paths.ts` before being stored or compared. Important conventions:

- Root is represented as `.`.
- Separators are `/`, even on Windows.
- `..` escapes are rejected with `RepoGuideError`.
- Guide paths are derived with `guidePathForFolder`, not string concatenation, because the root guide is `guide.md` while nested guides are `<folder>/guide.md`.

Use helpers such as `folderOf`, `joinRepoPath`, `isDescendantOrSelf`, and `absoluteFromRepo` rather than duplicating path logic. Many freshness and tree operations depend on exact string comparisons.

### Git paths with newlines are unsupported

`src/core/git.ts` uses NUL-delimited Git output where possible, but explicitly rejects paths containing `\n` or `\r`. This is intentional and tested. If adding new Git parsing code, keep the same behavior by validating paths before returning them.

### Submodules are opaque

`listTrackedEntries` reads `git ls-files --stage`, so submodules appear as gitlink entries with mode `160000`. They are treated as tracked entries but not recursed into as source files. Do not add filesystem recursion here unless it preserves that boundary.

### Mode-only changes do not make guides stale

Git reports chmod-only changes as `M`. `src/core/git.ts` distinguishes content changes by comparing `--name-status` with `--numstat`; `M` entries with no numstat content change become status `mode-only`. `src/core/stale.ts` ignores those for freshness. Keep this behavior when changing diff parsing, or chmod/line-ending noise will cause unnecessary guide updates.

## Data Flow

The common analysis path is:

1. `buildRepoContext(repoRoot, cwd)` in `src/core/plans.ts`
   - calls `listTrackedEntries`
   - loads `.guideignore`
   - filters source files
   - builds a `FolderTree`
2. A plan function chooses folders:
   - `initPlan` returns all folders deepest-first.
   - `checkPlan` returns the current folder’s descendants plus its ancestors.
   - `updatePlan` separates child folders from parent folders so children can be updated before parent summaries.
3. `staleFolders` calls `freshnessForFolder` for each planned folder.

The tree is built from both eligible source files and existing guide files. This means folders with an existing `guide.md` stay visible even if they currently have no eligible source files; that lets the tool check or update documentation-only guide nodes instead of silently dropping them.

## `.guideignore` Semantics

`loadGuideIgnore` in `src/core/guideignore.ts` wraps the `ignore` package and adds tool-specific defaults:

- Any `guide.md` is ignored as source input.
- `.guideignore` itself is ignored as source input.
- Patterns in `.guideignore` use gitignore-style matching, including negation order.

This filtering is used when building `RepoContext.sourceFiles`. Staleness checks also reload `.guideignore` to avoid marking ignored direct source changes as stale.

When changing ignore behavior, update both guide candidate generation and freshness expectations; otherwise the tree and stale checks can disagree.

## Freshness Model

`src/core/stale.ts` answers whether a folder’s guide needs attention. A folder needs attention when:

- its guide file is missing;
- its guide exists but has no Git history;
- a direct source file in that folder changed after the guide’s last commit or in the working tree;
- a descendant guide changed after the guide’s last commit or in the working tree;
- a descendant guide was updated earlier in the same run via `extraChangedGuides`.

Important boundaries:

- Only **direct child files** make a folder stale for source changes. Descendant source changes are expected to be summarized by descendant guides first, then propagated upward through “descendant guide changed”.
- Renames and deletes count by considering both `path` and `oldPath`.
- Guide changes propagate upward, but a guide does not mark itself stale because it changed.
- Mode-only changes are ignored.
- Ignored source files are ignored for staleness.

`freshnessForFolder` currently accepts `eligibleSourceFiles` but does not use it directly; it uses Git changes plus `.guideignore` checks. The argument is still part of the public core API and is passed from `staleFolders`.

## Planning Behavior

`src/core/plans.ts` encodes command-oriented folder selection:

- `repoRelativeFolder(repoRoot, cwd)` resolves real paths before calculating the current repo-relative folder. This helps with symlinks.
- `initPlan` is deepest-first for the whole tree, so leaf guides can be created before parent summaries.
- `checkPlan` includes both descendants of the current folder and ancestors up to root, then sorts by path.
- `updatePlan` returns:
  - `child`: descendants of the current folder, deepest-first;
  - `parent`: ancestors of the current folder, bottom-up, excluding folders already in `child`.

If you change ordering, check that parent guide generation still sees the child guide updates it is supposed to summarize.

## Error Handling

Use `RepoGuideError` from `src/core/errors.ts` for expected operational failures such as invalid repo paths, unsupported Git paths, or Git command failures. It carries an `exitCode` for the CLI layer. Avoid throwing raw `Error` for user-facing validation failures in this folder.

## Testing Notes

The tests in this folder use fixture Git repositories and cover edge cases that are easy to regress:

- spaces in paths;
- empty repositories and detached HEAD;
- renames, deletes, staged and unstaged changes;
- chmod-only changes;
- CRLF rewrites that Git considers unchanged;
- `.guideignore` negation;
- folders that only exist because they contain guides;
- submodules as opaque gitlinks;
- rejection of newline-containing Git paths.

When changing Git parsing or freshness logic, run the corresponding `src/core/*.test.ts` tests rather than relying only on high-level CLI tests.
