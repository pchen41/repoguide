# src/commands

## Responsibility

Implements the top-level command workflows for the CLI: checking guide freshness, estimating prompt/token cost, initializing missing guides, and updating stale guides. These command modules coordinate configuration loading, repository planning, guide freshness checks, provider selection, guide generation, and command exit codes.

## Important Files

- `src/commands/check.ts` — Implements `runCheck`, which reports guides needing attention and returns a nonzero exit code when stale or missing guides are detected.
- `src/commands/init.ts` — Implements `runInit`, which creates missing `guide.md` files using a guide provider, skips existing guides, reports stale existing guides, and supports dry runs.
- `src/commands/update.ts` — Implements `runUpdate`, which refreshes stale existing guides while avoiding guides with uncommitted local changes.
- `src/commands/estimate.ts` — Implements `runEstimate`, which mirrors init/update folder selection and prints approximate input and reserved output token counts without requiring provider calls.
- `src/commands/commands.test.ts` — Integration-style Vitest coverage for command behavior using fixture repositories and a fake guide provider.

## Child Modules

This folder has no child modules.

## Notes

- Commands generally return `CommandResult` from `src/commands/check.ts` with an `exitCode` instead of exiting the process directly.
- `runInit` and `runUpdate` require LLM configuration through `assertLlmConfig` unless a test or caller still supplies valid environment configuration.
- `runEstimate` intentionally does not call `assertLlmConfig`, so it can be used without API keys.
- Folder selection is delegated to planning helpers in `src/core/plans.ts`; freshness decisions are delegated to `src/core/stale.ts`.
- Guide creation and updating are delegated to `src/guides/generate.ts`, with the default provider coming from `src/llm/openai.ts`.
- Tests rely on injected `GuideProvider` implementations, dry-run options, and console capture rather than real LLM calls.
