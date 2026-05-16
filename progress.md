# repoguide Progress

Read `tasks.md` first. This file only tracks implementation progress against those tasks.

## Current Status

- Planning is complete.
- Initial implementation pass is complete.
- TypeScript CLI package, core modules, command handlers, README, and focused tests exist.
- Second pass added fixture-backed Git, freshness, command, and OpenAI provider tests.
- Third pass added prompt, guide generation, `.guideignore`, env, and tree edge-case tests.
- 100% coverage enforcement is intentionally skipped for now per user direction; coverage still reports current percentages.

## Task Progress

- Task 1: Project Scaffold - done.
- Task 2: Environment Configuration - partial.
- Task 3: Git Utilities - mostly done.
- Task 4: `.guideignore` - partial.
- Task 5: Folder Tree - partial.
- Task 6: LLM Provider Interface and OpenAI - mostly done.
- Task 7: Prompting and Guide Validation - partial.
- Task 8: `init` - partial.
- Task 9: Git-Based Freshness and `check` - mostly done.
- Task 10: `update` - partial.
- Task 11: `estimate init` and `estimate update` - partial.
- Task 12: Integration, Coverage, and Packaging - partial.

## In Flight

- None.

## Completed

- Task 1: Project Scaffold.

## Handoff Notes

- Initial implementation includes package scaffold, CLI registration, env loading, Git utilities, `.guideignore`, folder tree, OpenAI provider, prompt builder, guide validation, init/check/update/estimate commands, README, and focused unit tests.
- External reviews were run with Codex, Claude, and Gemini. Accepted fixes included safer guide writes, better update no-guide reporting, init stale-guide reporting, estimate scope alignment, less aggressive secret redaction, prompt budget improvements, and Git rename/delete path handling.
- Second pass added tests for repo root detection, tracked/untracked files, paths with spaces, staged/unstaged changes, renames, deletes, mode-only changes, missing/no-history guides, ignored freshness, child guide staleness, command init/check/update/estimate flows, OpenAI request shape, no-guide parsing, retry, timeout, and config validation.
- Third pass added tests for prompt binary/invalid UTF-8/submodule/truncation notes, guide generation dry-run/no-guide/failure/symlink refusal, tree ancestor/guide helpers, `.guideignore` comments/exact paths, and non-LLM env loading.
- Remaining work: cover path-newline failure, real submodule fixtures, CRLF/LF fixtures, detached HEAD, empty repos, README example assertions, and more command dry-run/no-guide/failure integration cases.
- Coverage command now reports but does not enforce 100% thresholds, by user request.

Task:
Task 1: Project Scaffold
Status:
done
Files changed:
package.json, package-lock.json, tsconfig.json, vitest.config.ts, src/cli.ts, README.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
done
Follow-ups:
None for scaffold.

Task:
Tasks 4, 5, 7, 8, 12
Status:
partial / better verified
Files changed:
src/guides/prompts.test.ts, src/guides/generate.ts, src/guides/generate.test.ts, src/core/tree.test.ts, src/core/guideignore.test.ts, src/config/env.test.ts
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
done for this pass; coverage rose to about 87% statements and broken guide symlinks are refused
Follow-ups:
Add remaining fixtures listed in Handoff Notes before calling Tasks 2-12 fully complete.

Task:
Tasks 3, 6, 8, 9, 10, 11
Status:
mostly done / better verified
Files changed:
src/core/git.ts, src/core/plans.ts, src/core/git.test.ts, src/core/stale.test.ts, src/commands/commands.test.ts, src/llm/openai.test.ts, src/test-utils/fixture-repo.ts
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
done for this pass; coverage rose to about 81% statements and key Git/freshness/provider behavior is covered
Follow-ups:
Add remaining fixtures listed in Handoff Notes before calling Tasks 2-12 fully complete.

Task:
Tasks 2-12
Status:
partial
Files changed:
src/config/*, src/core/*, src/guides/*, src/llm/*, src/commands/*, src/test-utils/*, README.md, vitest.config.ts
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run; headless Codex/Claude/Gemini reviews
Result:
partial implementation pass completed
Follow-ups:
Add comprehensive tests and finish edge-case behavior listed in Handoff Notes.

## Update Template

Use this format when updating task progress:

```txt
Task:
Status:
Files changed:
Tests run:
Result:
Follow-ups:
```

Use `Result:` for a concise outcome such as done, partial, or blocked plus the reason.
