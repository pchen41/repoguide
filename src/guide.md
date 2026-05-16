# src

## Responsibility

`src` is the TypeScript application root for the `repoguide` CLI. It wires the executable command surface to the command orchestration layer and holds shared constants that shape generation, validation, and provider behavior.

The top-level control flow is:

1. `src/cli.ts` builds the Commander program and registers user-facing commands.
2. Each command delegates immediately to `src/commands/*` using `process.cwd()` as the scope.
3. Command modules load config, build repository context through `src/core`, and call guide generation or checking logic as needed.
4. Guide generation uses `src/guides` for prompt/write behavior and `src/llm` for provider calls.

Keep this folder boundary thin. Top-level `src` should expose the CLI entrypoint and shared constants, not own repository traversal, prompt construction, config parsing, or provider behavior.

## Important Files

- `src/cli.ts`  
  Defines the public CLI shape and exit-code mapping. `buildProgram()` is intentionally exported for tests and documentation checks. The program uses Commander’s `exitOverride()`, so `main()` must translate Commander help/errors and `RepoGuideError` instances into process exit codes instead of letting Commander terminate the process directly. Add or rename commands here only together with README and CLI tests.

- `src/constants.ts`  
  Centralizes cross-module constants: the guide filename, exact no-guide sentinel, prompt budget, reserved model output tokens, and default max source-file bytes. These values are consumed across `src/core`, `src/guides`, `src/llm`, and `src/config`; changing them is a behavior change, not cosmetic cleanup.

- `src/readme.test.ts`  
  Enforces that README command examples stay in sync with the actual registered CLI commands. If the command surface changes, update `README.md`, `src/cli.ts`, and this test together.

## Child Modules

- `src/commands`  
  Command workflow implementations for `init`, `update`, `check`, and `estimate`. Go here when changing what a command does after CLI parsing: folder selection, counters, dry-run behavior, stale checks, provider invocation, or console summaries.

- `src/config`  
  Runtime configuration loading and validation. Go here for environment variables, `.env` behavior, config defaults, OpenAI/model validation, and secret-redaction behavior.

- `src/core`  
  Git/repository modeling, path normalization, guide-ignore handling, folder-tree construction, planning, and stale detection. Go here for changes to what folders/files are considered, command scopes, Git parsing, or freshness rules.

- `src/guides`  
  Per-folder guide generation pipeline: prompt construction, provider-output validation, no-guide handling, and safe filesystem writes. Go here for prompt contract changes, output markdown validation, prompt budgeting, skipped-file behavior, or write-safety rules.

- `src/llm`  
  Provider abstraction and OpenAI implementation. Go here for API transport behavior, retries, timeouts, model response extraction, and mapping provider outcomes into `ProviderResult`.

- `src/test-utils`  
  Shared test helpers for creating real temporary Git repositories. Go here when tests need reusable fixture setup around commits, working-tree state, and repository cleanup.

## Notes

- CLI exit codes are part of the public contract. `main()` maps successful help display to `0`, Commander usage errors to `2`, and `RepoGuideError.exitCode` through unchanged. Preserve this mapping unless updating tests and documentation intentionally.

- `buildProgram()` should remain side-effect-light and testable. It registers commands but should not perform repository inspection or config loading until command actions run.

- The executable guard in `src/cli.ts` compares `import.meta.url` to `process.argv[1]` via `pathToFileURL()`. This allows the file to be imported in tests without running the CLI.

- Top-level tests intentionally check behavior through the CLI surface, not implementation details. `src/cli-main.test.ts` verifies `main()` error/exit handling; `src/cli.test.ts` verifies command registration and Commander behavior; `src/readme.test.ts` verifies documentation drift.

- Keep shared constants stable and centralized. The no-guide sentinel must remain exact across prompt instructions, validation, and provider handling; the guide filename is assumed by core path logic and generated output workflows.
