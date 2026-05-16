# src

## Responsibility

Contains the TypeScript source for the RepoGuide CLI. This folder wires the command-line interface to the command workflow modules, defines shared constants, and contains top-level tests that verify CLI behavior and README command examples.

## Important Files

- `src/cli.ts` — CLI entry point and command registration. Builds the `repoguide` Commander program, registers `init`, `update`, `check`, `estimate init`, and `estimate update`, maps command results to `process.exitCode`, handles `RepoGuideError`, and runs `main()` when executed directly.
- `src/constants.ts` — Shared constants for guide generation and prompt budgeting, including `GUIDE_FILENAME`, `NO_GUIDE_SENTINEL`, `PROMPT_BUDGET_CHARS`, `RESERVED_OUTPUT_TOKENS`, and `DEFAULT_MAX_FILE_BYTES`.
- `src/cli.test.ts` — Tests CLI help output and unknown-command handling through `buildProgram`.
- `src/cli-main.test.ts` — Tests `main()` exit-code behavior for help, unknown commands, and user-facing `RepoGuideError` messages.
- `src/readme.test.ts` — Ensures README command examples stay aligned with registered CLI commands.

## Child Modules

- `src/commands` — Implements top-level command workflows for checking, estimating, initializing, and updating guides.
- `src/config` — Loads and validates environment-based configuration and enforces LLM settings when needed.
- `src/core` — Provides Git inspection, path utilities, ignore handling, folder tree construction, guide freshness checks, planning, token estimates, and shared errors.
- `src/guides` — Builds prompts, calls guide providers, validates generated guide markdown, and writes `guide.md` files.
- `src/llm` — Defines the provider abstraction and OpenAI-backed guide generation implementation.
- `src/test-utils` — Provides shared test helpers for creating temporary Git fixture repositories.

## Notes

- `src/cli.ts` is intentionally thin: command implementation details live in `src/commands`.
- CLI actions use `process.cwd()` as the repository scope passed into command runners.
- Command runners return structured results with exit codes; `src/cli.ts` sets `process.exitCode` rather than calling `process.exit` directly during normal command execution.
- Commander-generated help exits with code `0`, while Commander command errors and `RepoGuideError` failures are mapped to exit code `2`.
- Keep `src/readme.test.ts` in mind when adding, removing, or renaming CLI commands; README examples must stay synchronized with `buildProgram()`.
