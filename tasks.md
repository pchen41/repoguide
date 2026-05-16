# repoguide Tasks

This file is the implementation brief for `repoguide`, a TypeScript CLI that creates and updates `guide.md` files in Git repositories. It should be enough for an AI agent to read this file with no prior chat context and start building.

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
- If the LLM returns only `__REPOGUIDE_NO_GUIDE__`, do not create a guide.
- `init` skips existing guides by default. It may report that existing guides appear stale, but it must not overwrite them.
- Configure through environment variables and optional repo-root `.env` loading.
- Target the latest stable/current Node.js line for v1. As of May 16, 2026, official Node releases list v26 as Current and the latest release blog lists Node.js 26.1.0 Current. Use Node's built-in `.env` support; do not use `dotenv`.

Commands:

- `repoguide init`: create missing guides bottom-up across the repo.
- `repoguide update`: update stale guides in the current folder scope, including affected child and parent guides.
- `repoguide check`: report guides that are missing or stale.
- `repoguide estimate init`: estimate token usage for `init`.
- `repoguide estimate update`: estimate token usage for `update`.

Environment variables:

- `OPENAI_API_KEY`: required for OpenAI generation.
- `REPOGUIDE_PROVIDER`: provider name, default `openai`.
- `REPOGUIDE_MODEL`: model name.
- `REPOGUIDE_MAX_FILE_BYTES`: max source file size included in prompts.

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
- If a repo-root `.env` file exists, load it with Node built-in `.env` support, not `dotenv`.
- Shell environment values should take precedence over `.env` values.
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
- Invalid env values fail clearly.
- Secret values are redacted from diagnostics.
- `check` works without LLM env vars.

## Task 3: Git Utilities

Spec:

- Detect whether the current directory is inside a Git repo.
- Resolve the repo root from nested folders.
- List Git-tracked files with `git ls-files`.
- Normalize paths to repo-relative POSIX paths.
- Get the latest commit that changed a path.
- Detect staged and unstaged changes for tracked files.
- Ignore untracked files as source inputs.

Tests:

- Outside-repo errors are clear.
- Nested repo root detection works.
- Only tracked files are listed.
- Untracked files are ignored.
- Staged and unstaged tracked changes are detected.
- Paths with spaces work.
- Empty repos and repos with no commits are handled intentionally.

## Task 4: `.guideignore`

Spec:

- Load `.guideignore` from repo root if present.
- Apply patterns after Git-tracked files are listed.
- Support Gitignore-style exact paths, globs, directories, comments, blank lines, and negation according to the `ignore` package.
- Always exclude `guide.md` files from source-file input.
- Treat `.guideignore` itself as tool configuration, not guide source context.

Tests:

- Missing `.guideignore` changes nothing.
- Exact file, glob, and directory ignores work.
- Negation works.
- Comments and blank lines are ignored.
- `guide.md` files are excluded.
- `.guideignore` is not included in prompt source context.

## Task 5: Folder Tree

Spec:

- Build a folder tree from filtered tracked files.
- Each folder node knows its path, direct files, child folders, and whether `guide.md` exists.
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

## Task 6: LLM Provider Interface and OpenAI

Spec:

- Define a provider interface independent of OpenAI-specific types.
- The provider result must distinguish generated guide, no-guide, and error.
- Implement an OpenAI provider using `OPENAI_API_KEY` and `REPOGUIDE_MODEL`.
- Detect no-guide only when the model returns exactly `__REPOGUIDE_NO_GUIDE__` after trimming.
- Unit tests must mock the provider/client; never call the network.

Tests:

- Fake provider returns generated guide.
- Fake provider returns no-guide.
- Fake provider errors are surfaced with folder context.
- OpenAI provider sends expected model and prompt.
- Missing API key fails clearly.
- OpenAI no-guide and normal guide outputs are parsed correctly.

## Task 7: Prompting and Guide Validation

Spec:

- Build prompts from:
  - folder path
  - eligible direct file names and contents
  - notes for oversized skipped files
  - child guide contents when present
- Tell the LLM to return exactly `__REPOGUIDE_NO_GUIDE__` if the folder does not need a guide.
- Tell the LLM to mention real repo-relative paths and avoid inventing files.
- Standard guide structure:

```md
# path/to/folder

## Responsibility

## Important Files

## Child Modules

## Notes
```

- Reject empty guide output.
- Reject guide output missing required sections.
- If update gets no-guide for an existing guide, leave the existing guide unchanged and report it.

Tests:

- Prompt includes eligible direct files.
- Prompt excludes ignored and oversized files.
- Prompt includes child guides.
- Prompt is deterministic.
- No-guide instruction is present.
- Valid guide markdown passes.
- Missing sections fail.
- Existing guide is preserved on no-guide update.

## Task 8: `init`

Spec:

- Run from any folder inside the repo, only inits folder and subfolders.
- Build the filtered tree.
- Generate bottom-up so parent prompts can include generated child guides.
- Existing `guide.md` files are skipped.
- If an existing guide appears stale, report that `repoguide update` may refresh it.
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

- A guide is stale if eligible direct source files changed after the last commit that changed the guide.
- A guide is stale if child guides changed after the last commit that changed the guide.
- A guide with no Git history needs attention.
- A missing guide is reported as a candidate, not as proof that the folder needs a guide.
- Include staged and unstaged tracked changes.
- Ignore untracked and `.guideignore`-excluded files.
- `repoguide check` runs in current-folder scope.
- Exit `0` when nothing needs attention, `1` when guides need attention, and `2` on command errors.

Tests:

- Direct file change, add, and delete make the guide stale.
- Child guide change makes parent stale.
- Unrelated changes do not make a guide stale.
- Missing guides are reported as candidates.
- Untracked files do not affect freshness.
- Ignored tracked files do not affect freshness.
- Staged and unstaged changes are detected.
- Exit codes are correct.

## Task 10: `update`

Spec:

- Run from the current folder.
- Determine child scope: current folder and descendants.
- Determine parent scope: ancestors up to repo root.
- Use the same freshness logic as `check`.
- Regenerate stale child guides deepest-first.
- Then regenerate stale parent guides bottom-up toward root.
- Do not overwrite a guide with uncommitted changes; warn and skip it.
- Support `--dry-run`.

Tests:

- Updates stale descendant guides.
- Updates parent guides after child guide updates.
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
- Show total estimated input tokens, reserved output tokens, folder count, and largest folders.
- Estimation must not require API keys.

Tests:

- `estimate init` follows init scope.
- `estimate update` follows update scope and staleness.
- Ignored files do not contribute.
- Oversized files contribute only skipped-file notes.
- Child guide contents contribute.
- Largest folders are sorted.
- Empty scopes are handled.

## Task 12: Integration, Coverage, and Packaging

Spec:

- Add fixture-repo helpers for integration tests.
- Test init, check, update, estimate init, estimate update, `.guideignore`, and no-guide behavior end to end with fake providers.
- Add a coverage gate targeting 100% meaningful coverage.
- Add README with concise usage:
  - what `guide.md` is
  - environment setup
  - `.env` example using Node built-in loading
  - `.guideignore` example
  - `init`, `check`, `update`, `estimate init`, `estimate update`
- Add package metadata and an npm pack smoke test.

Tests:

- Integration tests require no network and no real API keys.
- Coverage command runs.
- Package contains built files.
- Binary runs after build/package.
- README examples match actual CLI behavior.

## Post-v1 Ideas

- `config` command for persisted settings.
- Additional providers.
- Provider-specific tokenizers.
- JSON output for `check` and `update`.
- Extra scope flags.
- `--force` for overwriting existing guides.
- CI mode.
- Guide link validation.
- Guide quality scoring.
- Configurable guide filename.
- Optional embedded metadata if a concrete need appears.
