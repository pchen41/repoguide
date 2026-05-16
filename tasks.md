# repoguide Tasks

This file is the implementation brief for `repoguide`, a TypeScript CLI that creates and updates `guide.md` files in Git repositories. It should be enough for an AI agent to read this file with no prior chat context and start building. Make commits when appropriate (probably after each task, but maybe some tasks should be multiple commits).

## Product Spec

`repoguide` creates human-readable `guide.md` files for codebase folders. These guides act like lightweight wiki pages for humans and navigational context for LLMs. Guides are committed to Git and travel with the code.

Each `guide.md` should explain:

- What the folder is responsible for.
- Important files and what they do.
- Child modules and their responsibilities.
- Important notes, conventions, or gotchas.

Core rules:

- Only Git-tracked files are considered as source input.
- `.guideignore` uses Gitignore-style patterns to exclude tracked source files from guide generation.
- `.guideignore` is tool configuration, not source context; do not summarize it into root guides.
- Generated `guide.md` files are excluded from source-file input, but child guide contents may be used when generating parent guides.
- Do not embed operational metadata in `guide.md`. Git is the source of truth for freshness and history.
- The LLM decides whether a folder deserves a guide.
- The no-guide sentinel is the exact internal string `__REPOGUIDE_NO_GUIDE__`.
- No-guide detection trims leading and trailing whitespace, then requires the entire response to equal `__REPOGUIDE_NO_GUIDE__`.
- If the LLM returns the no-guide sentinel, do not create a guide.
- No-guide decisions are not persisted in v1. A folder that previously returned no-guide may appear again as a missing-guide candidate in `check` or a future `init`; accept this tradeoff to avoid metadata.
- If `update` receives the no-guide sentinel for an existing guide, leave the guide unchanged, report it, and do not suppress future staleness reports. The user may delete the obsolete `guide.md` manually; v1 does not delete guides automatically.
- `init` skips existing guides by default. It may report that existing guides appear stale, but it must not overwrite them.
- Configure through environment variables and optional repo-root `.env` loading.
- Target Node.js 26 Current for v1. As of May 16, 2026, official Node releases list v26 as Current and the latest release blog lists Node.js 26.1.0 Current. Use Node's built-in `.env` support; do not use `dotenv`.

Commands:

- `repoguide init`: create missing guides bottom-up across the repo.
- `repoguide update`: update stale guides in the current folder scope, including affected child and parent guides.
- `repoguide check`: report guides that are missing or stale.
- `repoguide estimate init`: estimate token usage for `init`.
- `repoguide estimate update`: estimate token usage for `update`.

Command scopes:

- `init` runs on the current folder and subfolders.
- `check` runs from the current folder scope: the current folder, descendants, and ancestors up to the repo root. De-duplicate folders that appear in both descendant and ancestor sets.
- `update` uses the same current-folder scope as `check`: stale child guides are processed deepest-first, then stale ancestor guides are processed bottom-up toward the root.
- `estimate init` uses `init` scope.
- `estimate update` uses `update` scope.

Environment variables:

- `OPENAI_API_KEY`: required for OpenAI generation.
- `REPOGUIDE_PROVIDER`: provider name, default `openai`.
- `REPOGUIDE_MODEL`: model name; no default in v1.
- `REPOGUIDE_MAX_FILE_BYTES`: max source file size included in prompts, default `50000`.

CLI output:

- Normal human-readable reports go to stdout.
- Errors go to stderr.
- `check` prints each guide needing attention with concise reasons.
- `init` and `update` print created, skipped, stale, no-guide, and failed folder counts.
- `estimate init` and `estimate update` print estimated input tokens, reserved output tokens, folder count, and largest folders.
- Exit code `0` means the command completed successfully. For `check`, exit `1` means guides need attention and exit `2` means a command error.
- For `init` and `update`, exit `1` means one or more folder generations failed after being reported; no-guide results, stale-guide notices, skipped existing guides, and dry-run reports are not failures. Exit `2` means a command error.
- For `estimate init` and `estimate update`, exit `2` on command errors and otherwise exit `0`.
- Exact wording can evolve during implementation, but tests must pin the chosen output so README examples stay true.

Internal limits:

- Use an internal aggregate prompt budget of `120000` characters after per-file byte filtering.
- Use an internal reserved output budget of `2000` tokens per generated guide.
- Token estimates use `Math.ceil(characterCount / 4)` multiplied by a `1.2` safety factor, rounded up.

## Architecture

Suggested source layout:

```txt
src/
  cli.ts
  commands/
    check.ts
    estimate.ts
    init.ts
    update.ts
  config/
    env.ts
    schema.ts
  core/
    git.ts
    guideignore.ts
    paths.ts
    plans.ts
    stale.ts
    token-estimate.ts
    tree.ts
  guides/
    generate.ts
    prompts.ts
    validate.ts
  llm/
    openai.ts
    provider.ts
  test-utils/
    fixture-repo.ts
```

Suggested dependencies:

- TypeScript.
- Node.js v26.x.
- `commander` or `cac` for CLI parsing.
- Vitest for tests and coverage.
- `zod` for environment validation.
- `ignore` for `.guideignore`.
- Official OpenAI SDK for the OpenAI provider.
- Direct `git` subprocess calls for Git operations.

Aim for 100% meaningful unit test coverage. Cover edge cases, error paths, Git states, ignored files, path handling, prompt construction, and provider behavior.

Coverage target:

- Configure 100% statement, branch, function, and line coverage for `src`.
- Exclude generated build output, test fixtures, and type-only files that produce no runtime JavaScript.
- Do not exclude difficult runtime code just to satisfy coverage.

## Task 1: Project Scaffold

Spec:

- Create a TypeScript Node CLI package named `repoguide`.
- Add commands: `init`, `update`, `check`, `estimate init`, and `estimate update`.
- Add build, test, and coverage scripts.
- Add placeholder command handlers with correct help output and exit behavior.
- Set package engines to Node 26.x.

Tests:

- Help output lists all commands and estimate subcommands.
- Unknown commands fail.
- Placeholder commands are registered.
- Package binary points to the built CLI.
- Build succeeds.

## Task 2: Environment Configuration

Spec:

- Load configuration from `process.env`.
- Find the Git repo root before loading `.env`.
- If a repo-root `.env` file exists, load it with Node's built-in `loadEnvFile` from `node:process` or `process.loadEnvFile`, not `dotenv`.
- Check that `.env` exists before loading it, and fail clearly if an existing `.env` is malformed.
- Shell environment values must take precedence over `.env` values. Snapshot relevant existing env vars before loading `.env`, then restore those values if Node's loader overwrites them, including when `.env` loading throws.
- Validate env values with `zod`.
- Keep `__REPOGUIDE_NO_GUIDE__` as an internal constant, not user config.
- Non-LLM commands must not require API keys.
- LLM commands must clearly explain missing `OPENAI_API_KEY` or `REPOGUIDE_MODEL`.
- Never print secrets.

Tests:

- Defaults load with empty env.
- Env vars parse correctly.
- `.env` values load from a fixture repo.
- Shell env wins over `.env`.
- Malformed `.env` fails clearly without leaking secrets.
- Invalid env values fail clearly.
- Secret values are redacted from diagnostics.
- `check` works without LLM env vars.
- `REPOGUIDE_MODEL` is required for LLM commands.
- `REPOGUIDE_MAX_FILE_BYTES` defaults to `50000`.

## Task 3: Git Utilities

Spec:

- Detect whether the current directory is inside a Git repo.
- Resolve the repo root from nested folders.
- List Git-tracked files with `git ls-files`.
- Normalize paths to repo-relative POSIX paths.
- Get the latest commit that changed a path.
- Detect staged and unstaged changes for tracked files.
- Ignore untracked files as source inputs.
- Handle deletes, renames, file mode changes, symlinks, submodules, binary files, and paths with spaces.
- Do not follow symlinks when reading prompt source content. Include the symlink path and link target as a skipped-file note.
- Treat submodule gitlinks as opaque paths. Include the submodule path as a skipped-file note; do not recurse into the submodule in v1.
- Treat file mode-only changes as Git state to report in utilities, but do not make guide content stale by themselves.
- Treat paths with newlines as unsupported for v1 and fail with a clear error if encountered.

Tests:

- Outside-repo errors are clear.
- Nested repo root detection works.
- Only tracked files are listed.
- Untracked files are ignored.
- Staged and unstaged tracked changes are detected.
- Paths with spaces work.
- Deleted tracked files, renamed files, file mode changes, symlinks, submodules, and binary files are handled intentionally.
- Symlinks are not followed outside the repo.
- Submodules are not recursed into.
- File mode-only changes do not make guides stale.
- CRLF and LF line endings do not create false staleness when Git reports no content change.
- Detached HEAD works anywhere a normal HEAD commit works.
- Empty repos and repos with no commits are handled intentionally.
- Paths with newlines fail clearly.

## Task 4: `.guideignore`

Spec:

- Load `.guideignore` from repo root if present.
- Apply patterns after Git-tracked files are listed.
- Support Gitignore-style exact paths, globs, directories, comments, blank lines, and negation according to the `ignore` package.
- Always exclude `guide.md` files from source-file input.
- Treat `.guideignore` itself as tool configuration, not guide source context.
- Apply `.guideignore` with deterministic path ordering and preserve negation order.

Tests:

- Missing `.guideignore` changes nothing.
- Exact file, glob, and directory ignores work.
- Negation works.
- Comments and blank lines are ignored.
- `guide.md` files are excluded.
- `.guideignore` is not included in prompt source context.
- Negation order is covered.

## Task 5: Folder Tree

Spec:

- Build a folder tree from filtered tracked files.
- Each folder node knows its path, direct files, child folders, and whether `guide.md` exists.
- Include folders that have eligible direct files, eligible descendant files, existing `guide.md` files, or are ancestors of those folders.
- Exclude folders that contain only ignored files and have no eligible descendants or existing guide.
- Provide deterministic traversal:
  - deepest-first
  - root-first
  - ancestors
  - descendants
- Git does not track empty folders; handle that naturally.

Tests:

- Root files and nested files are represented correctly.
- Sibling order is deterministic.
- Deepest-first traversal works.
- Ancestor and descendant lookup works.
- Existing guide discovery works.
- Folders with only ignored files are excluded unless they contain an existing guide.

## Task 6: LLM Provider Interface and OpenAI

Spec:

- Define a provider interface independent of OpenAI-specific types.
- The provider result must distinguish generated guide, no-guide, and error.
- Implement an OpenAI provider using `OPENAI_API_KEY` and `REPOGUIDE_MODEL`.
- Detect no-guide only when the model returns exactly `__REPOGUIDE_NO_GUIDE__` after trimming.
- Run generation sequentially in v1 to control cost and rate-limit risk.
- Use a conservative per-folder timeout.
- Use at most one retry for transient provider failures, including HTTP 429 rate-limit responses. Back off before retrying.
- Use the internal reserved output budget as the max output token limit for guide generation.
- Unit tests must mock the provider/client; never call the network.

Tests:

- Fake provider returns generated guide.
- Fake provider returns no-guide.
- Fake provider errors are surfaced with folder context.
- OpenAI provider sends expected model and prompt.
- Missing API key fails clearly.
- OpenAI no-guide and normal guide outputs are parsed correctly.
- Timeout, retry, HTTP 429, and provider error behavior are covered.

## Task 7: Prompting and Guide Validation

Spec:

- Build prompts from:
  - folder path
  - eligible direct file names and contents
  - notes for oversized skipped files
  - child guide contents when present
- Tell the LLM to return exactly `__REPOGUIDE_NO_GUIDE__` if the folder does not need a guide.
- Tell the LLM that the no-guide sentinel must be plain text only, with no markdown fences, backticks, explanations, or extra text. Detection remains intentionally strict.
- Tell the LLM to mention real repo-relative paths and avoid inventing files.
- Sort files and child guides deterministically by repo-relative path.
- Skip binary files, invalid UTF-8 files, symlinks, and submodules, and include a skipped-file note.
- Enforce the internal aggregate prompt budget, not only `REPOGUIDE_MAX_FILE_BYTES`.
- When total eligible content exceeds the prompt budget, preserve the folder path, file list, skipped-file notes, and child guide headings first; then include or truncate file contents in deterministic repo-relative path order.
- Prefer truncating at line boundaries. If a single remaining line is too large, use a simple character slice and add a truncation note.
- Include clear prompt notes for any truncated file or child guide.
- Skip or truncate child guide content if needed to stay within the prompt budget.
- Use the same prompt builder for generation and estimation.
- Recommended guide shape is a free-form wiki page. The guide must start with the exact top heading, include useful body content, and include at least one second-level section. Suggested section ideas include:

```md
# path/to/folder

## How This Fits

## Main Workflows

## Contracts and Invariants

## Gotchas
```

- The required top heading is exact: `# .` for the repo root, otherwise `# path/to/folder` using the repo-relative POSIX folder path.
- Section headings are flexible; choose names that fit the folder instead of forcing a fixed template.
- Reject empty guide output.
- Reject guide output missing the required top heading, useful body content, or any second-level section.
- If update gets no-guide for an existing guide, leave the existing guide unchanged and report it.

Tests:

- Prompt includes eligible direct files.
- Prompt excludes ignored and oversized files.
- Prompt excludes binary and invalid UTF-8 files with skipped-file notes.
- Prompt handles many individually small files that exceed the aggregate prompt budget.
- Truncated prompt content is reported in prompt notes.
- Prompt includes child guides.
- Prompt is deterministic.
- No-guide instruction is present.
- Valid guide markdown passes.
- Missing body content or all second-level sections fails.
- Missing or wrong top heading fails.
- Top heading validation is exact and case-sensitive.
- Free-form sections are allowed.
- Existing guide is preserved on no-guide update.

## Task 8: `init`

Spec:

- Run from any folder inside the repo; v1 initializes the whole repository.
- Build the filtered tree.
- Generate bottom-up so parent prompts can include generated child guides.
- Existing `guide.md` files are skipped.
- If an existing guide appears stale, report that `repoguide update` may refresh it. Implement or reuse the shared freshness helper needed for this report even though the full `check` command is Task 9.
- Do not overwrite existing guides in v1.
- Support `--dry-run`.
- Respect `REPOGUIDE_MAX_FILE_BYTES`.
- Continue past no-guide results.

Tests:

- Deepest folders are generated before parents.
- Parent prompts can include child guide contents.
- Existing guides are skipped.
- Stale existing guides are reported but not overwritten.
- No-guide result writes nothing.
- Dry run writes nothing.
- Oversized files are skipped and reported.
- Provider failure reports the folder path.

## Task 9: Git-Based Freshness and `check`

Spec:

- Use Git commit ancestry and diffs, not timestamps, to decide freshness.
- Find the last commit that touched each `guide.md`.
- A guide is stale if `git diff --name-status <guideCommit>..HEAD` contains eligible direct source changes for that guide's folder.
- A guide is stale if a tracked source file is renamed into or out of that guide's folder. Check both old and new paths for rename records.
- File mode-only changes do not make guides stale.
- Also include staged and unstaged tracked changes because they are not part of `HEAD`.
- A guide is stale if `git diff --name-only <guideCommit>..HEAD` contains a descendant `guide.md`, or if staged/unstaged tracked changes contain a descendant `guide.md`.
- A guide with no Git history, including an untracked or newly added `guide.md`, needs attention.
- A missing guide is reported as a candidate, not as proof that the folder needs a guide.
- A no-guide result is not persisted, so missing candidates may be reported repeatedly.
- Ignore untracked and `.guideignore`-excluded files.
- `repoguide check` runs in current-folder scope: current folder, descendants, and ancestors up to repo root, with duplicates removed.
- Exit `0` when nothing needs attention, `1` when guides need attention, and `2` on command errors.

Tests:

- Direct file change, add, and delete make the guide stale.
- Child guide change makes parent stale.
- Unrelated changes do not make a guide stale.
- Missing guides are reported as candidates.
- Untracked files do not affect freshness.
- Ignored tracked files do not affect freshness.
- Staged and unstaged changes are detected.
- Guide files with no history are reported.
- Renames and deletes are handled.
- File mode-only changes do not make guides stale.
- Repeated missing candidates after no-guide results are accepted.
- Exit codes are correct.

## Task 10: `update`

Spec:

- Run from the current folder.
- Determine child scope: current folder and descendants.
- Determine parent scope: ancestors up to repo root.
- If the current folder appears in both scopes, process it once as part of the child scope and skip it in the parent pass unless it was not considered in the child pass.
- Use the same freshness logic as `check`.
- Regenerate stale child guides deepest-first.
- Then regenerate stale parent guides bottom-up toward root.
- Treat any child guide regenerated during the current `update` run as a staleness signal for parent guides in scope.
- Do not overwrite a guide with uncommitted changes; warn and skip it.
- Support `--dry-run`.

Tests:

- Updates stale descendant guides.
- Updates parent guides after child guide updates.
- Processes the current folder only once when it is both a child-scope and parent-scope folder.
- Freshly regenerated child guides cause parent guides to regenerate.
- Does not update unrelated guides.
- Skips guides with uncommitted changes.
- Dry run writes nothing.
- No-guide result leaves an existing guide unchanged.

## Task 11: `estimate init` and `estimate update`

Spec:

- `repoguide estimate init` estimates prompts that `init` would send.
- `repoguide estimate update` estimates prompts that `update` would send from the current folder.
- Use the same tree, ignore, file-size, child-guide, and freshness logic as the real commands.
- Use an approximate tokenizer for now.
- Use the shared internal token approximation and safety multiplier. Document that estimates are approximate.
- Show total estimated input tokens, reserved output tokens, folder count, and largest folders.
- Estimation must not require API keys.
- Estimation must call the same prompt construction path as generation so estimates do not drift.
- Build reusable plan functions in `core/plans.ts` or equivalent so `init`, `update`, `estimate init`, and `estimate update` do not duplicate scope and prompt-selection logic.

Tests:

- `estimate init` follows init scope.
- `estimate update` follows update scope and staleness.
- Ignored files do not contribute.
- Oversized files contribute only skipped-file notes.
- Aggregate prompt-budget truncation affects estimates the same way it affects generation.
- Child guide contents contribute.
- Largest folders are sorted.
- Empty scopes are handled.

## Task 12: Integration, Coverage, and Packaging

Spec:

- Add fixture-repo helpers for integration tests.
- Test init, check, update, estimate init, estimate update, `.guideignore`, and no-guide behavior end to end with fake providers.
- Include fixture coverage for CRLF vs LF line endings and deeply nested or broad repositories.
- Add a coverage gate targeting 100% meaningful coverage.
- Add README with concise usage:
  - what `guide.md` is
  - environment setup
  - `.env` example using Node built-in loading
  - `.guideignore` example
  - `init`, `check`, `update`, `estimate init`, `estimate update`
  - why `init` bootstraps the whole repo while `update` works from the current folder scope
- Add package metadata and an npm pack smoke test.

Tests:

- Integration tests require no network and no real API keys.
- Coverage command runs.
- Package contains built files.
- Binary runs after build/package.
- README examples match actual CLI behavior.
- Large-repo fixture validates deterministic traversal and bottom-up generation performance at a small but representative scale.

## Post-v1 Ideas

- `config` command for persisted settings.
- Additional providers.
- Provider-specific tokenizers.
- Configurable concurrency for large repositories.
- JSON output for `check` and `update`.
- Extra scope flags.
- `--force` for overwriting existing guides.
- CI mode.
- Guide link validation.
- Guide quality scoring.
- Configurable guide filename.
- Optional embedded metadata if a concrete need appears.
