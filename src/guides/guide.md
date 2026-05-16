# src/guides

## How This Fits

`src/guides` is the guide-production layer: it turns a planned folder from `src/core/plans.ts` / `src/core/tree.ts` into either a committed `guide.md`, a dry-run result, a no-guide decision, or a failure. It sits between repository discovery and the LLM provider:

1. Core code builds a `RepoContext` with a folder tree and Git metadata.
2. `generateForFolder` in `src/guides/generate.ts` builds a prompt for one `FolderNode`.
3. A `GuideProvider` from `src/llm/provider.ts` returns guide markdown, a no-guide result, or an error.
4. The markdown is validated locally before any filesystem write.
5. If valid and not a dry run, the guide is written to the path resolved by `src/core/paths.ts`.

This folder is intentionally not responsible for selecting which folders should be processed, discovering Git state, or talking to a specific LLM API. It owns prompt shape, guide-output validation, and safe writing behavior.

## Main Workflow

The central entry point is `generateForFolder` in `src/guides/generate.ts`.

Important contracts in that workflow:

- The provider receives the repo-relative folder path and the complete generated prompt.
- Provider errors are converted into `{ status: 'failed' }`; they are not thrown.
- Provider `no-guide` decisions are returned as `{ status: 'no-guide' }`; no validation or write happens.
- Markdown guide responses must pass `validateGuideMarkdown` before dry-run or write status is reported.
- `dryRun` validates the provider output but never creates `guide.md`.
- `updateExisting` only affects the returned status (`updated` vs `created`); it does not loosen validation or write-safety checks.
- Filesystem write errors are caught and returned as failed results.

Guide writes use `guidePathForFolder` and `absoluteFromRepo` from `src/core/paths.ts`. Keep path behavior centralized there rather than hand-building output paths in new generation code.

## Prompt Construction

`src/guides/prompts.ts` builds the prompt sent to the provider. The prompt is deliberately opinionated: it asks for an internal wiki page with useful maintainer context, not a generated file inventory. It also tells the provider to return the exact no-guide sentinel when a folder does not deserve a guide.

The prompt includes:

- the target folder path and required first heading;
- the list of direct files for the folder;
- readable direct-file contents, subject to safety and size limits;
- skipped-source notes for files that cannot or should not be included;
- existing child `guide.md` contents, so parent guides can summarize child modules using available local context;
- truncation notes when content is omitted due to aggregate prompt budget.

File content inclusion has several guards:

- Gitlinks with mode `160000` are treated as submodules and skipped.
- Symlinks are skipped and reported with their target.
- Files larger than `maxFileBytes` are skipped.
- Buffers containing NUL bytes are treated as binary.
- Invalid UTF-8 is skipped using a fatal `TextDecoder`.
- The aggregate prompt is bounded by `PROMPT_BUDGET_CHARS` unless an explicit `promptBudgetChars` is supplied.

When changing prompt wording, update `src/guides/prompts.test.ts` if the tested guidance changes intentionally. The tests assert important policy language because prompt drift directly changes generated guide quality.

## Validation Rules

`src/guides/validate.ts` enforces only structural requirements that are necessary for downstream consistency:

- empty output is rejected;
- the first non-leading-whitespace line must be exactly `# .` for the repository root or `# <folderPath>` for other folders;
- there must be body content after the top heading;
- there must be at least one `##` section heading.

Validation intentionally accepts flexible section names. Older generated guides with sections like `## Responsibility`, `## Important Files`, `## Child Modules`, and `## Notes` remain valid, but the prompt no longer forces that template.

`isNoGuideResponse` only recognizes the exact no-guide sentinel after trimming surrounding whitespace. Any extra text means it is not a no-guide response and should be handled as normal markdown or rejected by validation.

## Write Safety and Filesystem Invariants

`assertCanWriteGuide` in `src/guides/generate.ts` is the safety gate before writing. It allows a missing output file, but refuses to write when the target `guide.md` already exists as:

- a symlink;
- anything other than a regular file.

This is important because guide generation may be run over arbitrary repository contents. Do not bypass this check for update flows. In particular, writing through a symlink could modify a file outside the repository.

The final write normalizes output to exactly the provider markdown with trailing whitespace trimmed and one final newline appended.

## Gotchas

- `buildGuidePrompt` reads direct files from the working tree using repo-relative paths plus Git entry metadata. If a caller builds stale context and then mutates the checkout, prompt content can reflect the later filesystem state.
- Prompt truncation is deterministic but cumulative. Adding new prompt sections before file content may cause less source content to reach the provider.
- `truncatedNotes` can itself be affected by the budget. Tests cover the externally important behavior, but avoid depending on every incidental note string unless it is part of a user-facing contract.
- `outputGuidePath` in `src/guides/prompts.ts` mirrors guide-path construction but generation code uses `guidePathForFolder`. Prefer the core path helper for new write or read behavior to avoid path-policy drift.

## Testing Notes

The tests in this folder are behavior-focused and use fixture repositories from `src/test-utils/fixture-repo.ts`.

- `src/guides/generate.test.ts` covers status mapping, dry-run behavior, validation failures, provider failures, no-guide results, successful writes, and symlink refusal.
- `src/guides/prompts.test.ts` covers prompt policy text, direct-file inclusion, child guide inclusion, skipped-source notes, binary and invalid UTF-8 handling, submodule detection, and prompt-budget truncation.
- `src/guides/validate.test.ts` covers the exact no-guide sentinel behavior and the intentionally flexible markdown validation rules.

When changing guide structure policy, update prompt and validation tests together. When changing filesystem safety or write status semantics, update generation tests and check callers that may rely on `GenerateStatus`.
