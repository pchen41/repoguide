# repoguide Progress

Read `tasks.md` first. This file only tracks implementation progress against those tasks.

## Current Status

- Planning is complete.
- Initial implementation pass is complete.
- TypeScript CLI package, core modules, command handlers, README, and focused tests exist.
- Second pass added fixture-backed Git, freshness, command, and OpenAI provider tests.
- Third pass added prompt, guide generation, `.guideignore`, env, and tree edge-case tests.
- Fourth pass added empty repo, detached HEAD, newline path, init dry-run/no-guide/failure, and update no-guide/dry-run tests.
- Fifth pass added real local submodule, CRLF/LF no-diff freshness, CLI main error/help, and README command example tests.
- Sixth pass tuned guide prompting away from file inventories and toward internal wiki guidance.
- Seventh pass added `repoguide init --force` for regenerating existing guides.
- Eighth pass added generation progress messages for `init` and `update`.
- Ninth pass loosened guide validation and prompting from a fixed template to a free-form wiki page with a minimal heading/section contract.
- Tenth pass rewrote the README for a public GitHub audience.
- Eleventh pass added `repoguide site` for static HTML wiki export.
- 100% coverage enforcement is intentionally skipped for now per user direction; coverage still reports current percentages.

## Task Progress

- Task 1: Project Scaffold - done.
- Task 2: Environment Configuration - mostly done.
- Task 3: Git Utilities - mostly done.
- Task 4: `.guideignore` - mostly done.
- Task 5: Folder Tree - mostly done.
- Task 6: LLM Provider Interface and OpenAI - mostly done.
- Task 7: Prompting and Guide Validation - mostly done.
- Task 8: `init` - mostly done.
- Task 9: Git-Based Freshness and `check` - mostly done.
- Task 10: `update` - mostly done.
- Task 11: `estimate init` and `estimate update` - mostly done.
- Task 12: Integration, Coverage, and Packaging - mostly done.
- Task 13: Static HTML Wiki - mostly done.

## In Flight

- None.

## Completed

- Task 1: Project Scaffold.

## Handoff Notes

- Initial implementation includes package scaffold, CLI registration, env loading, Git utilities, `.guideignore`, folder tree, OpenAI provider, prompt builder, guide validation, init/check/update/estimate commands, README, and focused unit tests.
- External reviews were run with Codex, Claude, and Gemini. Accepted fixes included safer guide writes, better update no-guide reporting, init stale-guide reporting, estimate scope alignment, less aggressive secret redaction, prompt budget improvements, and Git rename/delete path handling.
- Second pass added tests for repo root detection, tracked/untracked files, paths with spaces, staged/unstaged changes, renames, deletes, mode-only changes, missing/no-history guides, ignored freshness, child guide staleness, command init/check/update/estimate flows, OpenAI request shape, no-guide parsing, retry, timeout, and config validation.
- Third pass added tests for prompt binary/invalid UTF-8/submodule/truncation notes, guide generation dry-run/no-guide/failure/symlink refusal, tree ancestor/guide helpers, `.guideignore` comments/exact paths, and non-LLM env loading.
- Fourth pass added tests for empty repos, detached HEAD, unsupported newline paths, init dry-run/no-guide/provider failure reporting, and update no-guide/dry-run preservation.
- Fifth pass added tests for real local submodule gitlinks, CRLF/LF rewrites when Git reports no diff, CLI `main()` help/unknown/outside-repo paths, and README command examples.
- Sixth pass updated prompt guidance to discourage obvious conventional-file descriptions and ask for responsibilities, boundaries, contracts, workflows, invariants, gotchas, and maintenance advice.
- Seventh pass added `init --force`, README/help coverage, and command tests proving default init still skips existing guides while force regenerates them.
- Eighth pass added progress output before provider calls, including bounded `init [i/n]` messages and incremental `update [i]` messages.
- Ninth pass replaced the fixed required-section guide template with flexible wiki sections while retaining exact top-heading validation and requiring at least one `##` section.
- Tenth pass expanded README positioning, setup, command behavior, guide style, privacy/source-input notes, exit codes, and development workflow for public GitHub readers.
- Eleventh pass added `repoguide site`, a self-contained static HTML wiki exporter with navigation, search, theme switching, Markdown rendering, tracked/untracked guide discovery, docs, and tests.
- Remaining work: 100% coverage enforcement remains intentionally skipped; extra hardening could include malformed `.env` behavior if Node exposes stricter parse errors, more README output wording assertions, and additional large-repo performance fixtures.
- Coverage command now reports but does not enforce 100% thresholds, by user request.

Task:
Task 13: Static HTML Wiki
Status:
mostly done / static wiki export added
Files changed:
src/commands/site.ts, src/commands/site.test.ts, src/core/git.ts, src/cli.ts, src/cli.test.ts, src/readme.test.ts, README.md, tasks.md, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm run pack:smoke; node dist/cli.js site --out /private/tmp/repoguide-site-check --title "repoguide Wiki"
Result:
`repoguide site` writes a ready-to-view static wiki from existing guide.md files
Follow-ups:
Browser visual verification of the file URL was blocked by the in-app browser URL policy; CLI export and generated HTML content were verified.

Task:
Task 12: Integration, Coverage, and Packaging
Status:
mostly done / README public polish
Files changed:
README.md, src/readme.test.ts, progress.md
Tests run:
npm run build; npm test; npm_config_cache=/private/tmp/repoguide-npm-cache npm run pack:smoke
Result:
public-facing README rewritten with clearer install, workflow, command, guide-style, privacy, exit-code, and development sections
Follow-ups:
None yet.

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
Task 7: Prompting and Guide Validation
Status:
mostly done / free-form wiki format enabled
Files changed:
src/guides/prompts.ts, src/guides/validate.ts, src/guides/prompts.test.ts, src/guides/validate.test.ts, tasks.md, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
guides may now use free-form wiki sections instead of the old fixed four-section template
Follow-ups:
Regenerate existing guides with `repoguide init --force` to apply the new format.

Task:
Tasks 8 and 10: `init` and `update`
Status:
mostly done / progress output added
Files changed:
src/commands/init.ts, src/commands/update.ts, src/commands/commands.test.ts, README.md, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
generation commands now print progress before each provider call
Follow-ups:
Consider a richer spinner or elapsed-time output later if needed.

Task:
Tasks 8 and 12: `init` and Packaging Docs
Status:
mostly done / force regeneration added
Files changed:
src/commands/init.ts, src/cli.ts, src/commands/commands.test.ts, src/cli.test.ts, README.md, src/readme.test.ts, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
`repoguide init --force` regenerates existing guides while default init remains non-overwriting
Follow-ups:
None for force regeneration.

Task:
Task 7: Prompting and Guide Validation
Status:
mostly done / quality tuned
Files changed:
src/guides/prompts.ts, src/guides/prompts.test.ts, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
prompt now asks for internal wiki content and avoids obvious file inventory filler
Follow-ups:
Regenerate existing guides with the new prompt; consider adding a force/regenerate command option.

Task:
Tasks 3, 9, 12
Status:
mostly done / better verified
Files changed:
src/core/git.test.ts, src/core/stale.test.ts, src/cli-main.test.ts, src/readme.test.ts, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
done for this pass; 46 tests pass and coverage is about 92% statements / 94% lines
Follow-ups:
100% coverage enforcement remains intentionally skipped by user request.

Task:
Tasks 3, 8, 10, 12
Status:
mostly done / better verified
Files changed:
src/core/git.ts, src/core/git.test.ts, src/commands/commands.test.ts, progress.md
Tests run:
npm run build; npm test; npm run coverage; npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run
Result:
done for this pass; 41 tests pass and coverage is about 89% statements / 90% lines
Follow-ups:
Add remaining fixtures listed in Handoff Notes before calling Tasks 2-12 fully complete.

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
