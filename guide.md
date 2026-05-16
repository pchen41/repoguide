# .

## How This Repository Fits Together

`repoguide` is a TypeScript CLI package that generates committed `guide.md` wiki pages for Git repositories. The root folder is the product/package boundary: it defines the npm package, public command surface, build/test configuration, implementation brief, and maintainer handoff notes.

The actual runtime implementation lives under `src`. Use `src/guide.md` as the starting point for code-level navigation; the root is mainly for package-wide contracts and project workflow.

The public CLI surface is intentionally small:

- `repoguide init`
- `repoguide init --force`
- `repoguide check`
- `repoguide update`
- `repoguide estimate init`
- `repoguide estimate update`

Changes that alter this command surface should be reflected together in `README.md`, CLI tests under `src`, and any workflow documentation.

## Maintainer Workflow

Before implementation work, read `tasks.md`. It is the authoritative product and architecture brief, including edge cases and test expectations. `progress.md` is the living handoff log: update it when changing task status, adding notable behavior, or leaving follow-up work.

For agent-driven work, `AGENTS.md` contains the repo-specific operating note and examples for launching other coding agents headlessly. In particular, it documents that `tasks.md` should be read before implementation and `progress.md` should be updated when task status changes.

Typical validation commands are:

- `npm run build`
- `npm test`
- `npm run coverage`
- `npm run pack:smoke`

Use `npm run pack:smoke` before packaging-sensitive changes because the package publishes only `dist` and `README.md`.

## Package and Runtime Contracts

This package is ESM-only and targets Node.js `26.x`. The TypeScript configuration uses `module`/`moduleResolution` set to `NodeNext`, emits declarations and source maps into `dist`, and treats `src` as the only runtime source root.

Important package-level contracts:

- The npm binary is `repoguide`, pointing at `./dist/cli.js`.
- Build output is not source-of-truth; edit `src`, then run `npm run build`.
- `package-lock.json` is committed and should be kept in sync with dependency changes.
- Runtime dependencies are deliberately narrow: CLI parsing, Gitignore-style matching, OpenAI provider support, and schema validation.
- Tests use Vitest and live next to source files as `src/**/*.test.ts`; they are excluded from the build.

Do not add a second configuration system casually. The product spec in `tasks.md` requires environment variables plus a repo-root `.env` loaded through Node’s built-in support, not `dotenv`.

## Documentation and Spec Boundaries

`README.md` is the user-facing quickstart and command reference. Keep it concise and aligned with actual CLI behavior. There is a dedicated README test in `src/readme.test.ts` that pins command examples, so command or option changes need matching documentation and tests.

`tasks.md` is more detailed than normal project documentation because it doubles as an implementation brief for agents. It captures product behavior that may not be obvious from the code, including:

- Git-tracked files are the only source inputs.
- `.guideignore` affects guide prompts but is not itself guide content.
- `guide.md` files are excluded as source files, while child guide contents may inform parent guides.
- The no-guide sentinel is exactly `__REPOGUIDE_NO_GUIDE__`.
- Freshness is based on Git history and diffs, not timestamps.
- `init` and `update` intentionally have different scopes.

When behavior changes, update `tasks.md` if the product contract changes, and update `progress.md` with what was actually implemented or deferred.

## Root Configuration Notes

The root TypeScript and Vitest configs are intentionally simple. `tsconfig.json` excludes tests and `src/test-utils` from emitted package output. `vitest.config.ts` includes all `src/**/*.ts` files for coverage except tests, test utilities, and declaration files.

Coverage is currently reported but not enforced at 100%, despite the original task brief asking for a full coverage gate. This is an intentional project-status decision recorded in `progress.md`; do not reintroduce strict thresholds without confirming that direction.

The `.gitignore` is broad enough for common Node and frontend tooling artifacts. RepoGuide-specific source filtering is not handled there; generated-guide input filtering belongs to `.guideignore` in repositories where `repoguide` is run.

## Child Module Map

Go to `src` for implementation work. Its child guide explains the code boundaries in detail:

- `src/commands` owns command workflows, progress output, dry-run behavior, counters, provider injection, and exit codes.
- `src/core` owns Git interaction, path normalization, `.guideignore`, tree construction, planning, and freshness semantics.
- `src/guides` owns prompt construction, guide validation, no-guide handling, and safe writes.
- `src/config` owns environment loading and validation.
- `src/llm` owns provider abstractions and OpenAI integration.
- `src/test-utils` owns shared fixture repository helpers for tests.

As a rule, root-level changes should be about package shape, documentation, task tracking, or build/test configuration. Runtime behavior usually belongs under `src`.

## Gotchas

- This repository is itself the tool that generates `guide.md` files. Avoid treating guides as generated throwaways; they are committed internal wiki pages and should be useful to future maintainers.
- `tasks.md` may describe desired or historical behavior in more detail than `README.md`; prefer it when implementing internals.
- `progress.md` is append-style handoff context, not a replacement for tests. Keep entries concise but specific about files changed, tests run, outcomes, and follow-ups.
- Node 26 is part of the product contract. Dependency or API choices should not silently broaden or lower the runtime target.
- If command examples change, update `README.md` and the README/CLI tests together.
