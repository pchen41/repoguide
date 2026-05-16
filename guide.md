# .

## Responsibility

This repository is the `repoguide` TypeScript CLI package. Its job is to generate committed `guide.md` wiki pages for folders in Git repositories, using Git-tracked source context, `.guideignore` filtering, prompt construction, and an LLM provider.

The repository root owns package-level concerns:

- npm package metadata, binary wiring, Node/TypeScript/Vitest configuration, and lockfile state.
- User-facing product documentation in `README.md`.
- Agent/developer workflow state in `tasks.md` and `progress.md`.
- The `src` implementation tree, which owns all runtime CLI behavior.

The main development flow is:

1. Read `tasks.md` for the product/architecture contract.
2. Inspect `progress.md` for what has already been implemented or intentionally deferred.
3. Change implementation under `src`.
4. Run `npm run build`, `npm test`, and usually `npm run coverage`.
5. Update `progress.md` when task status changes.

## Important Files

- `tasks.md`  
  The authoritative implementation brief. It defines product behavior, command scopes, exit-code contracts, Git freshness rules, prompt requirements, no-guide semantics, environment behavior, and the intended module layout. Treat it as the spec when code and docs are ambiguous.

- `progress.md`  
  The handoff log for implementation passes. It records which task areas are done, mostly done, or intentionally not finished. Update it when changing task status or making notable implementation decisions; do not treat it as user documentation.

- `AGENTS.md`  
  Operational notes for coding agents. It explicitly instructs agents to read `tasks.md` before implementation and to update `progress.md` when changing task status. It also documents how to invoke other headless agents without nesting Claude Code sessions.

- `package.json`  
  Defines the shipped CLI package contract: package name `repoguide`, binary path `./dist/cli.js`, Node engine `26.x`, ESM mode, scripts, and published files. The `bin` path assumes `npm run build` has emitted `dist/cli.js`.

- `README.md`  
  User-facing usage contract. Tests in `src/readme.test.ts` check command examples against the actual CLI, so command-surface changes should update `README.md` and tests together.

- `tsconfig.json`  
  Builds only production TypeScript from `src` into `dist`, excluding tests and `src/test-utils`. It uses `NodeNext` module semantics and strict checking; changes here can affect emitted package shape and CLI import behavior.

- `vitest.config.ts`  
  Centralizes test discovery and coverage inclusion. Coverage currently reports over `src/**/*.ts` while excluding tests, declarations, and test utilities; `progress.md` notes that 100% enforcement is intentionally skipped for now.

## Child Modules

- `src`  
  Runtime implementation and tests for the CLI. Go here for all behavior changes: command orchestration, Git utilities, `.guideignore`, folder planning, freshness checks, prompt generation, guide validation/writes, configuration loading, and LLM providers. The root should remain package/documentation/configuration glue rather than owning runtime logic.

## Notes

- Target Node is `26.x`. The code and docs intentionally rely on Node’s built-in `.env` loading rather than `dotenv`.

- `guide.md` is a generated-but-committed artifact in target repositories, but this repository’s own guide files are documentation for maintainers. Do not add generated metadata to guides; Git history is the freshness source of truth.

- The no-guide sentinel is exact and internal: `__REPOGUIDE_NO_GUIDE__`. It is specified in `tasks.md` and centralized in code under `src/constants.ts`; avoid duplicating or reconfiguring it casually.

- `package-lock.json` is large and should be kept in sync with `package.json`. It is not useful prompt context for guide generation beyond dependency locking.

- The expected verification loop is:
  - `npm run build`
  - `npm test`
  - `npm run coverage`
  - `npm_config_cache=/private/tmp/repoguide-npm-cache npm pack --dry-run` when packaging behavior changes

- Command behavior is tightly specified, especially exit codes and scope differences:
  - `init` bootstraps missing guides bottom-up and skips existing guides unless `--force` is used.
  - `update` works from current-folder scope, handling descendants and ancestors.
  - `check` reports missing/stale guides and uses exit `1` for attention needed.
  - `estimate` commands must not require API keys and should share prompt/planning paths with real generation.

- Keep README command examples synchronized with the registered CLI. The test suite intentionally guards against documentation drift.

- `.gitignore` excludes normal Node/build/test artifacts including `dist`, coverage, caches, `.env`, and Vite/Vitest state. `.env.example` is explicitly allowed if added later.
