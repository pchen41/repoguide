# src/test-utils

## Responsibility

Shared test-only utilities for building controlled fixtures around repository state. This folder sits outside production code paths and exists to keep tests from hand-rolling temporary Git repositories, filesystem setup, commits, and cleanup logic.

The central contract is that utilities here create isolated, disposable test environments that behave like real Git repositories. Tests using these helpers can exercise code that depends on Git metadata, committed files, paths, permissions, and working tree state without touching the developer’s checkout.

## Important Files

- `src/test-utils/fixture-repo.ts` — Provides `createFixtureRepo()`, which creates a temporary real Git repository under the OS temp directory, configures local Git identity, and exposes helpers for writing files, creating directories, running Git commands, committing all changes, and cleaning up. This is the preferred way for tests to set up repository-backed fixtures.

## Child Modules

None.

## Notes

- `createFixtureRepo()` uses the real `git` executable via `execFileSync`. Tests that depend on it require Git to be installed and available on `PATH`.
- The fixture root is created with `fs.mkdtempSync()` under `os.tmpdir()` and normalized through `fs.realpathSync.native()`. Prefer using the returned `root` instead of reconstructing temp paths manually.
- `write(repoPath, contents)` and `mkdir(repoPath)` take repository-relative paths and join them to the fixture root. Do not pass absolute paths unless the test intentionally relies on `path.join()` behavior with absolute segments.
- `git(args)` runs synchronously with `cwd` set to the fixture root and returns stdout as UTF-8. Stderr is captured by `execFileSync` and surfaced on thrown errors, so failed Git commands will fail the test immediately.
- `commitAll()` stages `.` and creates a commit. It will fail if there is nothing to commit; tests should only call it after creating or modifying tracked content.
- The helper configures `user.email`, `user.name`, and `core.filemode` locally in the fixture repo. If a test needs different Git config behavior, override it through `fixture.git(['config', ...])` after creation.
- Always call `cleanup()` in test teardown, preferably in `afterEach`/`finally`, to avoid leaving temporary repositories behind.
