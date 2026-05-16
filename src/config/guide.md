# src/config

## Responsibility

Owns Repoguide runtime configuration: loading environment values, applying defaults, validating types and ranges, preserving shell environment precedence, redacting secrets in errors, and asserting when LLM-specific settings are required.

## Important Files

- src/config/env.ts — Implements `loadConfig`, which finds the repository root, loads repository environment values, restores shell-provided values over file-provided values, validates with `envSchema`, and returns `{ config, repoRoot }`. Also provides `assertLlmConfig` for enforcing provider, API key, and model requirements before guide generation.
- src/config/schema.ts — Defines `envSchema` with Zod and exports the inferred `RepoGuideConfig` type. This is where defaults and basic validation rules for supported environment variables live.
- src/config/env.test.ts — Covers default loading, shell precedence over file values, invalid value reporting without leaking secrets, and the fact that LLM credentials are not required until `assertLlmConfig` is used.

## Child Modules

None.

## Notes

- Keep the environment variable list in `src/config/env.ts` aligned with the schema in `src/config/schema.ts` whenever adding new configuration keys that may be loaded from a repository environment file.
- `loadConfig` intentionally allows missing LLM secrets so non-generation commands can run without `OPENAI_API_KEY` or `REPOGUIDE_MODEL`.
- `assertLlmConfig` is the boundary that turns optional LLM settings into required settings.
- Error messages must not leak secret values; preserve the redaction behavior when changing validation or loading errors.
