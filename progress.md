# repoguide Progress

Read `tasks.md` first. This file only tracks implementation progress against those tasks.

## Current Status

- Planning is complete.
- Initial implementation pass is complete.
- TypeScript CLI package, core modules, command handlers, README, and focused tests exist.
- 100% coverage enforcement is intentionally skipped for now per user direction; coverage still reports current percentages.

## Task Progress

- Task 1: Project Scaffold - done.
- Task 2: Environment Configuration - partial.
- Task 3: Git Utilities - partial.
- Task 4: `.guideignore` - partial.
- Task 5: Folder Tree - partial.
- Task 6: LLM Provider Interface and OpenAI - partial.
- Task 7: Prompting and Guide Validation - partial.
- Task 8: `init` - partial.
- Task 9: Git-Based Freshness and `check` - partial.
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
- Remaining work: broaden integration/unit coverage, fully exercise Git edge cases, refine mode-only freshness detection, add OpenAI provider retry/timeout tests, and harden prompt budget priority with more fixtures.
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
