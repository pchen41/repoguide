# .

## Responsibility

The repository root defines the `repoguide` TypeScript CLI package: project metadata, build/test configuration, user-facing documentation, and implementation planning. The CLI generates committed `guide.md` files for Git repository folders, using Git state, `.guideignore`, prompt construction, and an LLM provider to create or update lightweight wiki pages.

## Important Files

- `README.md` — User-facing overview with setup instructions, `.env` configuration example, `.guideignore` example, and documented commands: `repoguide init`, `repoguide check`, `repoguide update`, `repoguide estimate init`, and `repoguide estimate update`.
- `package.json` — npm package definition for `repoguide`, including the `repoguide` binary at `dist/cli.js`, Node `26.x` engine requirement, scripts for build/test/coverage/pack smoke tests, and runtime/dev dependencies.
- `package-lock.json` — Locked npm dependency graph for reproducible installs.
- `tsconfig.json` — TypeScript compiler configuration targeting ES2024 with `NodeNext` modules, strict type checking, declarations, source maps, and `dist` output.
- `vitest.config.ts` — Vitest configuration for `src/**/*.test.ts` tests and V8 coverage collection over `src/**/*.ts`.
- `tasks.md` — Full implementation brief and product specification, including command behavior, environment handling, Git rules, prompting rules, freshness logic, tests, and post-v1 ideas.
- `progress.md` — Current implementation status and handoff notes. Update this when task status changes.
- `AGENTS.md` — Agent-specific instructions, including the requirement to read `tasks.md` before implementation and update `progress.md` when changing task status.
- `.gitignore` — Standard Node/TypeScript ignore rules for logs, caches, environment files, build outputs, dependency folders, and Vite artifacts.

## Child Modules

- `src` — Contains the TypeScript implementation, tests, and internal modules for the CLI, command workflows, configuration, Git utilities, prompt and guide generation, LLM providers, and test fixtures.

## Notes

- Read `tasks.md` before making implementation changes; it is the authoritative product and architecture brief.
- Update `progress.md` whenever task status changes or implementation work is handed off.
- The package targets Node.js `26.x`; avoid adding dependencies or APIs that conflict with that runtime target.
- Build output is generated into `dist` and is intentionally not part of the source tree.
- `guide.md` files are committed documentation artifacts for repository navigation; source prompts exclude generated guides except when parent prompts use child guide contents.
- `.guideignore` is supported by the tool but is not present in this repository root.
