# src

## How This Fits

`src` is the top-level implementation boundary for RepoGuide. It contains the CLI entrypoint, process-level constants, and the major feature areas that do the real work:

- `src/commands` orchestrates user workflows (`init`, `update`, `check`, `estimate`).
- `src/core` models the Git repository, guide paths, planning, and freshness rules.
- `src/guides` builds prompts, validates model output, and writes `guide.md`.
- `src/config` loads and validates environment/configuration.
- `src/llm` is the provider abstraction and OpenAI integration.
- `src/test-utils` provides fixture Git repositories for tests.

The top-level `src/cli.ts` should stay thin. It owns command registration, process exit-code mapping, and expected CLI error handling. It should not learn repository scanning rules, prompt structure, provider behavior, or freshness semantics; those belong in the child modules above.

## CLI Entry Point and Exit Semantics

`src/cli.ts` exports two entry points:

- `buildProgram()` constructs the Commander program and is used by tests to inspect help output and command registration.
- `main(argv = process.argv)` is the executable wrapper used when the package is run as a CLI.

The registered command surface is:

- `repoguide init`
  - `--dry-run`
  - `--force`
- `repoguide update`
  - `--dry-run`
- `repoguide check`
- `repoguide estimate init`
- `repoguide estimate update`

Each CLI action delegates immediately to the matching `run*` function in `src/commands` and then sets `process.exitCode` from the returned `{ exitCode }`.

Important exit-code behavior:

- Command workflow results decide normal command exit codes.
- `RepoGuideError` is considered an expected user-facing failure: print only `error.message` to stderr and use `error.exitCode`.
- Commander help exits as `0`.
- Commander usage errors, such as unknown commands, map to `2`.
- Other unexpected errors are printed and also map to `2`.

Do not replace `process.exitCode` handling with direct `process.exit()` in normal workflow code. Tests rely on being able to call `main()` and inspect `process.exitCode` without terminating the process.

## Constants and Shared Policy

`src/constants.ts` is the central place for cross-module policy constants:

- `GUIDE_FILENAME` is the canonical guide filename.
- `NO_GUIDE_SENTINEL` is the exact model response that means “do not create a guide”.
- `PROMPT_BUDGET_CHARS` bounds prompt construction.
- `RESERVED_OUTPUT_TOKENS` is the output token reservation used by the LLM layer.
- `DEFAULT_MAX_FILE_BYTES` is the default direct-file inclusion limit for prompts.

If changing one of these values, check all consumers rather than treating the change as local. In particular:

- The no-guide sentinel is part of the prompt/provider/validation contract.
- Prompt budget and max-file limits affect generated guide quality and token estimation.
- Reserved output tokens affect OpenAI request sizing and tests in `src/llm`.

## Main Control Flow

A typical generation command flows through the codebase like this:

1. `src/cli.ts` parses arguments and calls a `run*` command.
2. `src/commands` loads configuration, builds repository context, chooses a plan, reports progress, and returns an exit code.
3. `src/core` provides Git state, repo-relative path semantics, tree construction, guide planning, and stale/fresh decisions.
4. `src/guides` builds the folder prompt, calls a `GuideProvider`, validates markdown, and writes `guide.md` if appropriate.
5. `src/llm` sends the already-built prompt to the configured provider and normalizes the response.

Keep these layers clean. If a change needs to know “which folders should be processed,” it usually belongs in `src/core` or `src/commands`. If it needs to know “what prompt should be sent” or “is this guide markdown valid,” it belongs in `src/guides`. If it needs to know OpenAI request/retry behavior, it belongs in `src/llm`.

## Child Modules

### `src/commands`

Go here when changing what a CLI command does after it has been parsed. This layer owns workflow orchestration, progress output, counters, dry-run behavior, provider injection, and command exit codes.

Notable contracts:

- `runCheck` is read-only and exits `1` when guides need attention.
- `runInit` creates missing guides bottom-up and skips existing guides unless `--force`.
- `runUpdate` updates stale existing guides, protects guides with uncommitted edits, and does not create missing guides.
- `runEstimate` mirrors real planning logic without requiring LLM credentials or calling a provider.

### `src/core`

Go here for repository modeling and freshness rules. It centralizes Git calls, `.guideignore`, repo-relative paths, folder tree construction, and command planning.

Important invariants:

- Repo-relative root is `.`.
- Repo paths are POSIX-style.
- `guidePathForFolder` should be used instead of hand-built guide paths.
- Submodules are opaque gitlinks.
- Mode-only changes do not make guides stale.
- Direct source changes affect that folder; descendant changes propagate upward through descendant guide freshness.

### `src/guides`

Go here for prompt content, output validation, and safe guide writes. This layer turns a planned `FolderNode` into `created`, `updated`, `dry-run`, `no-guide`, or `failed`.

Important invariants:

- Provider output is validated before write or dry-run success.
- The first heading must match the target folder.
- At least one `##` section is required.
- The exact no-guide sentinel is recognized only after trimming surrounding whitespace.
- Existing symlink or non-regular `guide.md` targets are refused.

### `src/config`

Go here for environment and `.env` behavior. `loadConfig(cwd)` resolves the repo root, loads repo-local `.env`, preserves shell precedence, validates config, and returns `{ config, repoRoot }`.

Generation commands should call `assertLlmConfig(config)` only when they actually need provider credentials/model settings. Inspection and estimate workflows should remain usable without secrets.

### `src/llm`

Go here for provider integrations. Code outside this folder should use `GuideProvider`, not an SDK directly.

The OpenAI implementation sends a fully composed prompt through the Responses API, reserves output tokens via `RESERVED_OUTPUT_TOKENS`, recognizes the no-guide sentinel through guide validation helpers, retries transient failures once, and returns normalized provider results rather than throwing for ordinary API failures.

### `src/test-utils`

Go here only for shared test infrastructure. The current helper creates real temporary Git repositories and is used by integration-style tests that need actual Git behavior.

## Testing Notes

The top-level tests focus on the CLI contract rather than command internals:

- `src/cli.test.ts` verifies registered commands/help and Commander unknown-command behavior.
- `src/cli-main.test.ts` verifies `main()` exit-code mapping and `RepoGuideError` handling.
- `src/readme.test.ts` keeps README command examples aligned with the registered CLI surface.

When changing command names, options, or help-visible structure, update tests and README together. `src/readme.test.ts` intentionally asserts the README command examples exactly:

- `repoguide init`
- `repoguide init --force`
- `repoguide check`
- `repoguide update`
- `repoguide estimate init`
- `repoguide estimate update`

For workflow behavior, prefer tests in the relevant child module:

- Command orchestration and output: `src/commands`
- Git/path/freshness behavior: `src/core`
- Prompt/write/validation behavior: `src/guides`
- Provider behavior: `src/llm`
- Config and environment behavior: `src/config`

## Gotchas

- `buildProgram()` calls `.exitOverride()`. This is intentional so `main()` and tests can convert Commander exits into RepoGuide’s exit-code behavior.
- Unknown Commander errors should not print an extra raw error from `main()`; Commander already writes usage errors through its configured output path.
- `main()` detects direct execution by comparing `import.meta.url` with `pathToFileURL(process.argv[1]).href`. Keep this check if refactoring the CLI entrypoint for ESM.
- Top-level CLI tests mock `process.exit`, `process.cwd`, and console/stdout/stderr. Always restore global process state in tests that add similar mocks.
- The constants in `src/constants.ts` encode cross-layer contracts. Changing them can alter prompt generation, model calls, validation, and estimate output all at once.
