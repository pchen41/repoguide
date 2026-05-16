# src/guides

## Responsibility

`src/guides` owns the guide-generation pipeline for a single repository folder. It turns a `FolderNode` plus repository context into an LLM prompt, sends that prompt through a `GuideProvider`, validates the provider output against the required `guide.md` contract, and safely writes the resulting file.

This folder sits between:

- `src/core`, which provides repository structure, path normalization, git metadata, and `RepoContext`.
- `src/llm`, which abstracts the model/provider interaction behind `GuideProvider`.
- CLI or orchestration code elsewhere, which decides which folders should be processed and with which options.

The main control flow is:

1. `generateForFolder` receives a `RepoContext`, a target `FolderNode`, a `GuideProvider`, and file-size limits.
2. `buildGuidePrompt` assembles a bounded prompt from direct file contents, child guide contents, skipped-source notes, and strict formatting instructions.
3. The provider returns either a guide, a no-guide result, or an error.
4. `validateGuideMarkdown` enforces the required guide shape before any write.
5. `assertCanWriteGuide` checks the destination is safe to overwrite.
6. The guide is written to the path from `guidePathForFolder`, unless dry-run was requested.

The folder is intentionally narrow: it does not decide repository traversal strategy, provider implementation, or CLI behavior. It only handles prompt construction, response validation, and per-folder persistence.

## Important Files

- `src/guides/generate.ts` is the central write path. `generateForFolder` is responsible for mapping provider outcomes to `GenerateResult` statuses, enforcing validation before writing, honoring dry-run/update flags, and preventing unsafe writes through symlinks or non-regular files. Any change here affects when committed `guide.md` files are created or updated.

- `src/guides/prompts.ts` defines the prompt contract sent to guide providers. This is where required guide structure, no-guide sentinel instructions, direct source inclusion, child-guide inclusion, skip reasons, and aggregate prompt-budget behavior are controlled. Prompt changes should be treated as behavior changes because they affect generated documentation quality and validation success rates.

- `src/guides/validate.ts` is the local schema gate for model output. It requires the exact top-level heading for the folder path and the four required section headings. It also defines the exact no-guide sentinel check via `isNoGuideResponse`.

## Child Modules

None.

## Notes

- Provider output is not trusted. `generateForFolder` validates guide markdown before any filesystem write. Keep this invariant if adding new provider result types or output formats.

- The no-guide sentinel is handled as a provider result type by `generateForFolder`, while `src/guides/validate.ts` also exposes `isNoGuideResponse` for code that needs to classify raw text. The sentinel must remain exact after trimming; extra text means it is not a no-guide response.

- `buildGuidePrompt` reads only direct files for the target folder, not recursive descendants. Context from descendants is supplied through existing child `guide.md` files when present. This keeps parent guides high-level and makes child guides the handoff mechanism for deeper context.

- File inclusion in prompts is deliberately conservative:
  - Gitlinks with mode `160000` are reported as submodules and skipped.
  - Symlinks are reported and skipped rather than followed.
  - Files larger than `maxFileBytes` are skipped.
  - Buffers containing NUL bytes are treated as binary.
  - Invalid UTF-8 is skipped.
  These skip notes are part of the prompt when budget allows, so generated guides can mention relevant limitations without seeing the file contents.

- `PROMPT_BUDGET_CHARS` is an aggregate cap, not a per-file cap. `appendWithBudget` may truncate individual file content, child guide content, skipped notes, or truncation notes to keep the final prompt within budget. Tests assert deterministic reporting for these cases; update `src/guides/prompts.test.ts` when changing budget behavior.

- `assertCanWriteGuide` uses `lstatSync` to reject guide-path symlinks before writing. Do not replace this with a plain existence check or `statSync`, because following symlinks would allow writing outside the repository.

- `generateForFolder` returns `created` or `updated` based on the caller’s `updateExisting` option, not by detecting whether the target file already existed. Callers are responsible for passing options that match their orchestration intent.

- `outputGuidePath` in `src/guides/prompts.ts` overlaps conceptually with `guidePathForFolder` from `src/core/paths.ts`. Prefer the core path helper in new write-path code so path behavior stays centralized.

- Tests use fixture repositories and real filesystem operations. Symlink, binary, invalid UTF-8, prompt truncation, validation failure, dry-run, and provider-error behavior are all covered in this folder’s tests; extend those tests when changing safety or prompt semantics.
