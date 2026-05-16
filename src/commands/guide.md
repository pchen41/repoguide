# src/commands

## How This Fits

`src/commands` contains the programmatic implementations of the CLI workflows: checking guide freshness, creating missing guides, refreshing stale guides, and estimating LLM token usage. These functions are thin orchestration layers. They should decide *what workflow to run and how to report it*, while delegating repository modeling, freshness rules, prompt construction, file writes, and provider calls to nearby modules.

The main entry points are:

- `runCheck`
- `runInit`
- `runUpdate`
- `runEstimate`

Each command returns a shared `CommandResult` shape with an `exitCode`, and writes human-facing progress/status output directly to `console.log` / `console.error`.

## Command Responsibilities

### `runCheck`

`runCheck` is read-only. It loads config, builds repository context, determines the current repo-relative folder, then asks `checkPlan` which folders are relevant. For each planned folder it calls `freshnessForFolder`.

Important behavior:

- Exits `0` only when no planned guide needs attention.
- Exits `1` when one or more guides are stale, missing, or otherwise need attention.
- Prints `All guides are fresh.` on success.
- Prints one line per attention item as:
  - `<folder.path>: <reason>, <reason>`

Do not add generation or mutation behavior here. `check` is intentionally a pure reporting command apart from stdout.

### `runInit`

`runInit` creates guides for folders in the repository, using `initPlan`.

Important behavior:

- Requires LLM config via `assertLlmConfig`, even when a provider is not explicitly supplied.
- Uses `OpenAIGuideProvider` by default, but tests and callers can inject a `GuideProvider`.
- Walks the init plan in the order returned by `initPlan`; current behavior relies on deepest folders being generated before parents.
- Skips existing guides unless `force` is set.
- If an existing skipped guide appears stale, it reports that fact but does not update it.
- With `force`, existing guides are regenerated using `updateExisting: true`.
- With `dryRun`, generation is planned and provider interaction still happens through `generateForFolder`, but guides are not written.

Counters are part of the user contract. Preserve their meanings:

- `created`: incremented for both newly created and force-updated guides.
- `skipped`: existing guides skipped because `force` was not set.
- `stale`: skipped existing guides that freshness logic considers stale.
- `no-guide`: provider said the folder does not deserve a guide.
- `dry-run`: generation would have happened but no file was written.
- `failed`: provider/generation failure.

A nonzero exit code is used only for failed generations, not for stale skipped guides or `no-guide` responses.

### `runUpdate`

`runUpdate` refreshes existing guides that need attention. It does not create missing guides.

Important behavior:

- Requires LLM config via `assertLlmConfig`.
- Builds an `updatePlan` from the current repo-relative folder.
- Processes child folders before parent folders.
- Recomputes freshness for each folder immediately before updating it.
- Skips folders whose guide is missing.
- Skips guides with uncommitted changes, protecting local edits.
- Tracks guides updated during this run with `changedGuides`, so parent freshness can account for child guides already regenerated in the same command.

This `changedGuides` set is important: without it, parent guides may still look stale because their child guide inputs changed during the current update run.

Provider `no-guide` results leave the existing guide unchanged and are not failures. Actual failed generations produce stderr output and make the command exit `1`.

### `runEstimate`

`runEstimate` is a dry accounting workflow, not a generation workflow.

It intentionally mirrors real command selection logic:

- `estimate init` uses `initPlan`, then excludes folders that already have guides.
- `estimate update` uses `updatePlan`, then includes only existing guides that need attention.
- It builds real guide prompts with `buildGuidePrompt` and estimates input tokens from prompt character counts.
- It does not require API credentials, because it does not call an LLM provider.

Keep this command aligned with `runInit` and `runUpdate` planning rules. If prompt selection, folder ordering, or freshness eligibility changes in the real commands, update estimate behavior too.

## Control Flow and Boundaries

A typical command follows this pipeline:

1. `loadConfig(cwd)` resolves repo root and environment-derived settings.
2. `buildRepoContext(repoRoot, cwd)` scans the repository and prepares tree/source/git context.
3. A plan function from `src/core/plans.ts` chooses target folders.
4. `freshnessForFolder` from `src/core/stale.ts` decides whether existing guides need attention.
5. Generation commands call `generateForFolder` from `src/guides/generate.ts`.
6. Provider calls go through `GuideProvider`, with `OpenAIGuideProvider` as the default production provider.
7. Commands print progress and return `{ exitCode }`.

Keep command modules free of low-level repository logic. If behavior depends on tree construction, git entries, guide paths, or staleness rules, it usually belongs in `src/core`. If behavior depends on prompt content or guide file writing, it usually belongs in `src/guides`.

## Contracts and Invariants

- Commands accept an optional `cwd`; tests rely on this to run inside fixture repositories.
- `runInit` and `runUpdate` accept injected providers. Preserve this seam for tests and non-OpenAI integrations.
- `runCheck` and `runEstimate` should not call providers.
- `runUpdate` must not overwrite guides with uncommitted changes.
- `runUpdate` must not create missing guides; missing guide creation belongs to `runInit`.
- `runInit` without `force` must not overwrite existing guides.
- `runEstimate` should not require `OPENAI_API_KEY` or model configuration.
- Progress output is tested and effectively part of the CLI contract. Be cautious when changing message text, counter names, or ordering.

## Gotchas

- `runInit` calls `assertLlmConfig` before deciding whether every guide will be skipped. This means even a no-op init currently requires LLM configuration.
- `runEstimate` avoids this by only using config values needed for prompt sizing, especially `REPOGUIDE_MAX_FILE_BYTES`.
- `folder.path` may be `.` for the repo root. Output and provider calls should preserve that convention.
- `guidePathForFolder('.')` is used to map the root folder to the root `guide.md`; do not hand-roll guide paths in commands.
- `runInit` uses `created` for both create and force-regenerate results. This is existing behavior and is asserted by tests.
- `runUpdate`’s progress index has no `/total` because eligibility can change as earlier folders are updated.

## Testing Notes

`src/commands/commands.test.ts` is an integration-style test suite for command workflows using fixture repositories. It verifies planning order, stdout/stderr messages, exit codes, provider injection, dry-run behavior, stale detection, and protection of uncommitted guide edits.

When changing command behavior, add or update tests here if the change affects:

- folder selection or ordering;
- counter summaries;
- progress output;
- exit-code semantics;
- provider result handling;
- dry-run behavior;
- stale/missing guide handling;
- environment variable requirements.

The fake provider in these tests records requested folder paths, which is often the clearest way to assert command planning without depending on generated markdown content.
