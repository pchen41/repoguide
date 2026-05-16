# src/config

## Responsibility

`src/config` owns runtime configuration loading and validation for RepoGuide. It converts the process environment plus an optional repository-local `.env` file into a typed `RepoGuideConfig`, and separates “general config can be loaded” from “LLM generation is allowed”.

The main control flow is:

1. `loadConfig(cwd)` resolves the Git repository root via `src/core/git.ts`.
2. It looks for `.env` at that repo root, not necessarily at the current working directory.
3. It loads `.env` values into `process.env` using Node’s `loadEnvFile`.
4. It restores pre-existing shell values for known RepoGuide keys so shell environment takes precedence over `.env`.
5. It validates/coerces config through the Zod schema in `schema.ts`.
6. Callers that actually need model access must separately call `assertLlmConfig(config)`.

This folder should stay limited to configuration parsing, defaults, validation, and safety checks. It should not decide command behavior, perform API calls, or inspect repository contents beyond resolving the repo root and reading `.env`.

## Important Files

- `src/config/env.ts`  
  Central entry point for consumers. `loadConfig()` returns both parsed config and the resolved repo root. It intentionally mutates `process.env` only as needed to load `.env`, then restores shell-provided values for RepoGuide-specific keys. It also redacts `OPENAI_API_KEY` from error messages. `assertLlmConfig()` is deliberately separate so commands that do not need an LLM can run without `OPENAI_API_KEY` or `REPOGUIDE_MODEL`.

- `src/config/schema.ts`  
  Defines the config contract and defaults. `REPOGUIDE_MAX_FILE_BYTES` is coerced from strings, must be a positive integer, and defaults to `DEFAULT_MAX_FILE_BYTES` from `src/constants.ts`. Adding a new environment variable usually requires updating this schema and the relevant env snapshot/restore list in `env.ts`.

- `src/config/env.test.ts`  
  Documents important behavior around `.env` loading, shell precedence, secret redaction, and delayed LLM validation. Update these tests when changing config precedence or validation semantics.

## Child Modules

None.

## Notes

- `.env` is resolved from the Git repo root returned by `findRepoRoot(cwd)`. If code passes a nested working directory, config still comes from the repository-level `.env`.

- Shell environment must win over `.env`. This is enforced by snapshotting known RepoGuide env keys before loading `.env` and restoring shell values afterward.

- Keep `RELEVANT_ENV` in `src/config/env.ts` in sync with environment variables that may be loaded from `.env` and need shell precedence preservation. If a new key is added to `schema.ts` but not to `RELEVANT_ENV`, `.env` may unexpectedly override a shell value for that key.

- `loadConfig()` should remain safe for non-generation commands. Do not make `OPENAI_API_KEY` or `REPOGUIDE_MODEL` required in `envSchema`; require them only in `assertLlmConfig()`.

- Error messages must not leak secrets. Any new validation or `.env` loading errors that include environment-derived values should pass through the existing redaction path or equivalent protection.

- Tests mutate `process.env`; preserve snapshot/restore behavior in tests to avoid cross-test contamination.
