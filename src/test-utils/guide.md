# src/test-utils

## Responsibility

Provides shared utilities for tests. This folder currently focuses on creating temporary Git repositories that tests can populate, mutate, commit, and clean up.

## Important Files

- `src/test-utils/fixture-repo.ts`: Exports `createFixtureRepo()`, which creates a temporary Git repository under the system temp directory, configures local Git identity settings, and returns helpers for writing files, making directories, running Git commands, committing all changes, and removing the fixture repository.

## Child Modules

None.

## Notes

- `createFixtureRepo()` shells out to the `git` executable, so tests using it require Git to be available on the system path.
- Call `cleanup()` after using a fixture repository to remove the temporary directory.
- Repository-relative paths passed to `write()` and `mkdir()` are resolved inside the temporary repository root.
