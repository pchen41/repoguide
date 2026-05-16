# src/commands

## Responsibility

`src/commands` contains the programmatic implementations of the top-level Repoguide CLI workflows:

- `check`: inspect existing `guide.md` files and report stale/missing-attention conditions.
- `init`: generate guides for folders that deserve them, usually for a repository without guides yet.
- `update`: refresh existing guides that are stale, while avoiding overwriting local guide edits.
- `estimate`: build the same prompts that generation would use and report approximate token usage without requiring LLM credentials.

These modules are intentionally thin orchestration layers. They load configuration, build a repository context, choose a plan from `src/core/plans.ts`, call freshness logic from `src/core/stale.ts`, and delegate actual prompt/generation/provider behavior to `src/guides` and `src/llm`.

The shared command contract is `CommandResult` with an `exitCode`. Commands also write user-facing status to `console.log` / `console.error`; tests assert on this output, so output wording and counters are part of the practical CLI behavior.

## Important Files

- `src/commands/init.ts`  
  Implements initial guide creation and optional regeneration via `force`. `initPlan(context)` is processed in plan order, which currently matters because tests expect deepest folders before parents. Existing guides are skipped unless `force` is set; skipped guides are still checked for staleness so users are told to run `update` or `init --force`.

- `src/commands/update.ts`  
  Refreshes only existing guides that need attention. It processes child folders before parent folders and tracks `changedGuides` so parent freshness checks can account for guides updated earlier in the same run. It also refuses to overwrite guides with uncommitted changes.

- `src/commands/estimate.ts`  
  Mirrors real `init` / `update` folder selection but stops before provider calls. This is the safest place to change token reporting behavior because it uses `buildGuidePrompt` and the configured `REPOGUIDE_MAX_FILE_BYTES` to estimate the actual prompt shape.

- `src/commands/check.ts`  
  Read-only freshness command. It builds the same repository context as generation commands but only reports folders whose freshness result has `needsAttention`.

- `src/commands/commands.test.ts`  
  Integration-style command tests using fixture Git repositories and a fake provider. These tests document important behavior: generation order, stale detection, no-guide handling, dry-run semantics, skipped uncommitted guides, and whether API keys are required.

## Child Modules

None.

## Notes

- Keep command modules as orchestration, not business-logic owners. Planning belongs in `src/core/plans.ts`, stale/missing/uncommitted detection belongs in `src/core/stale.ts`, prompt construction belongs in `src/guides/prompts.ts`, and provider interaction belongs under `src/llm`.

- `runInit` and `runUpdate` call `assertLlmConfig(config)` even for dry runs when no provider is injected. `runEstimate` deliberately does not require LLM credentials.

- Tests commonly inject a `GuideProvider` through command options. Preserve this seam when changing command behavior; it keeps command tests deterministic and avoids network calls.

- `init` treats both `created` and `updated` generation statuses as `created` in its final counter because from the user’s perspective `init --force` regenerated a guide as part of creation/bootstrap.

- `update` should not create missing guides. It filters out freshness results with `missing`; use `init` for guide creation.

- When `update` receives a provider `no-guide` result, the existing guide must be left unchanged. This differs from initial generation, where `no-guide` simply means no file is written.

- `dryRun` results must not write guide files. Counter output is still expected so callers can see what would have happened.

- Console output is part of the observable CLI contract. If changing messages or summary counter names, update `src/commands/commands.test.ts` and any CLI-facing documentation together.

- Command functions default `cwd` to `process.cwd()`, but tests and callers can pass an explicit folder. The current folder affects `repoRelativeFolder` and therefore `check` / `update` scope.
