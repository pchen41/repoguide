# src/guides

## Responsibility

This folder owns guide creation for repository folders. It builds the LLM prompt for a folder, calls a `GuideProvider`, validates the returned markdown, and writes the resulting `guide.md` safely.

It also defines the validation rules for generated guide content and the sentinel response used when a folder should not receive a guide.

## Important Files

- `src/guides/generate.ts` coordinates generation for one folder. It builds the prompt with `buildGuidePrompt`, calls the provider, handles `no-guide` and provider errors, validates markdown with `validateGuideMarkdown`, supports dry runs, and writes `guide.md`.
- `src/guides/generate.ts` also contains `assertCanWriteGuide`, which prevents writing through symlinks or non-file `guide.md` paths.
- `src/guides/prompts.ts` builds the prompt sent to the provider. It includes direct file paths, readable source contents, skipped-file notes, child guide contents, and truncation notes while respecting the prompt budget.
- `src/guides/prompts.ts` skips submodules, symlinks, oversized files, binary files, and invalid UTF-8 files.
- `src/guides/validate.ts` validates generated guide markdown. A valid guide must start with the exact folder heading and include `## Responsibility`, `## Important Files`, `## Child Modules`, and `## Notes`.
- `src/guides/validate.ts` also detects exact `NO_GUIDE_SENTINEL` responses after trimming.
- `src/guides/generate.test.ts` covers dry-run behavior, writing, no-guide responses, provider failures, validation failures, and symlink refusal.
- `src/guides/prompts.test.ts` covers prompt content, skipped-file notes, child guide inclusion, and prompt truncation behavior.
- `src/guides/validate.test.ts` covers sentinel detection and markdown validation.

## Child Modules

There are no child modules under `src/guides`.

## Notes

- Generated guides are always written as UTF-8 with a single trailing newline.
- `generateForFolder` returns structured statuses: `created`, `updated`, `no-guide`, `failed`, or `dry-run`.
- Prompt construction relies on repository context from `src/core/plans.ts`, tree data from `src/core/tree.ts`, git metadata from `src/core/git.ts`, and path helpers from `src/core/paths.ts`.
- Provider integration uses the `GuideProvider` interface from `src/llm/provider.ts`.
- Constants such as `GUIDE_FILENAME`, `NO_GUIDE_SENTINEL`, and `PROMPT_BUDGET_CHARS` come from `src/constants.ts`.
