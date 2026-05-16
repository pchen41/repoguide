# src/config

## How This Fits

`src/config` is the runtime configuration boundary for RepoGuide. Code outside this folder should treat configuration as a parsed, typed `RepoGuideConfig` rather than reading raw environment variables directly.

The main entry point is `loadConfig(cwd)`, which:

1. Resolves the Git repository root using `findRepoRoot` from `src/core/git.js`.
2. Looks for a repo-local `.env` file at that root.
3. Loads `.env` values into `process.env`.
4. Restores shell-provided values so the caller’s environment takes precedence over `.env`.
5. Validates and normalizes the resulting environment through the Zod schema in `src/config/schema.ts`.
6. Returns both the parsed config and resolved `repoRoot`.

This means callers get two pieces of state that are intentionally coupled: the configuration and the repository root used to locate `.env`.

## Configuration Contracts

The schema in `src/config/schema.ts` defines the supported environment surface:

- `OPENAI_API_KEY`
- `REPOGUIDE_PROVIDER`
- `REPOGUIDE_MODEL`
- `REPOGUIDE_MAX_FILE_BYTES`

Important invariants:

- `REPOGUIDE_PROVIDER` defaults to `openai`.
- `REPOGUIDE_MAX_FILE_BYTES` is coerced to a positive integer and defaults to `DEFAULT_MAX_FILE_BYTES` from `src/constants.js`.
- LLM credentials and model are optional at load time.
- LLM credentials and model become required only when `assertLlmConfig(config)` is called.

That split is deliberate. Non-generation workflows should be able to load config without requiring secrets.

## Shell vs `.env` Precedence

`loadConfig` uses Node’s `loadEnvFile`, which mutates `process.env`. To keep expected CLI behavior, this folder preserves shell precedence manually:

- Existing shell values for relevant keys are snapshotted before loading `.env`.
- After `.env` loading, shell values are restored.
- Values missing from the shell may still be supplied by `.env`.

When changing config keys, update the relevant-key handling in `src/config/env.ts`; otherwise shell precedence and cleanup behavior may silently diverge from schema behavior.

## Error Handling and Secret Redaction

Configuration failures are wrapped in `RepoGuideError` from `src/core/errors.js`.

`src/config/env.ts` redacts `OPENAI_API_KEY` from error messages before throwing. Keep this property intact when modifying validation or `.env` loading paths. Tests assert that invalid environment errors do not leak secret values.

The redaction currently only targets `OPENAI_API_KEY`, so adding new secret-bearing config keys should include corresponding redaction behavior.

## When to Use `assertLlmConfig`

Use `loadConfig` when a command needs general repository/config context.

Use `assertLlmConfig(config)` only at the boundary where guide generation actually needs an LLM provider. This keeps validation user-friendly:

- Commands that inspect files or compute repo context can run without API keys.
- Generation fails early with clear errors if provider, key, or model settings are missing or unsupported.

`assertLlmConfig` currently enforces that only `openai` is supported. If adding providers, this function is the enforcement point that must change alongside schema and generation code.

## Testing Notes

`src/config/env.test.ts` is the regression suite for the main contracts:

- Defaults load without LLM secrets.
- `.env` values are honored.
- Shell environment values override `.env`.
- Invalid values throw `RepoGuideError`-style messages without exposing secrets.
- LLM-specific fields are not required until `assertLlmConfig`.

Tests mutate `process.env`, so they snapshot and restore known keys after each case. If new config keys are added, extend that test key list to avoid cross-test contamination.
