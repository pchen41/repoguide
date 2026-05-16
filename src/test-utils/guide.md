# src/test-utils

## Purpose

`src/test-utils` contains shared helpers for tests that need realistic repository state instead of mocked filesystem data. The current utility builds an isolated, disposable Git repository on disk so tests can exercise code paths that depend on actual Git behavior, commits, working-tree state, file modes, paths, and command output.

Use this folder for cross-test infrastructure only. Test-specific setup should stay in the test file unless it is reused or encodes a repo-level invariant that many tests need.

## Fixture Repository Workflow

`src/test-utils/fixture-repo.ts` exports `createFixtureRepo()`, which creates a temporary repository under the OS temp directory with a `repoguide-test-` prefix.

The returned `FixtureRepo` object provides:

- `root`: absolute real path to the temporary repository.
- `write(repoPath, contents)`: writes a file relative to the fixture repo root, creating parent directories.
- `mkdir(repoPath)`: creates directories relative to the fixture repo root.
- `git(args)`: runs `git` synchronously in the fixture repo and returns stdout as UTF-8.
- `commitAll(message?)`: stages all changes and creates a commit.
- `cleanup()`: recursively removes the temp repository.

Typical usage pattern:

```ts
const repo = createFixtureRepo();

try {
  repo.write('src/example.ts', 'export const value = 1;\n');
  repo.commitAll('add example');

  // run code under test against repo.root
} finally {
  repo.cleanup();
}
```

Always call `cleanup()` in a `finally` block or equivalent test cleanup hook. The helper intentionally creates real directories and Git history, so leaked fixtures accumulate in the system temp directory.

## Contracts and Invariants

The fixture repo is initialized with a real `git init`, not a fake `.git` directory. This is important because tests using this utility are expected to validate behavior against Git’s actual command semantics.

The helper configures repository-local identity:

- `user.email=repoguide@example.com`
- `user.name=Repo Guide`

This keeps `git commit` independent of a developer’s global Git configuration and makes CI behavior deterministic.

It also sets:

- `core.filemode=true`

Tests that depend on executable-bit detection or file mode changes can rely on Git tracking mode changes inside the fixture. Be careful when adding tests that assume platform-specific filesystem behavior; Git may still behave differently on filesystems that do not support Unix-style permissions.

Paths passed to `write()` and `mkdir()` are repository-relative. Do not pass absolute paths unless you intentionally want `path.join(root, repoPath)` behavior, which may ignore the fixture root on some platforms.

## When to Extend This Folder

Add helpers here when they are broadly useful for repository-oriented tests, especially if they:

- reduce repeated Git setup boilerplate,
- encode stable fixture behavior needed by multiple test suites,
- make cleanup safer or more consistent,
- improve cross-platform handling of temporary repos.

Avoid adding assertions or behavior that is specific to one feature area. This utility should stay focused on creating and manipulating fixture repositories, not on knowing what production code is supposed to output.

## Gotchas

`git(args)` uses `execFileSync` with stderr captured. Failed commands throw, and the thrown error contains command output details. Tests that intentionally exercise failing Git commands should catch the exception explicitly.

`commitAll()` stages `.` from the fixture root. It will include every untracked and modified file in the temp repo, so tests should avoid leaving incidental files around before committing.

The temp root is normalized with `fs.realpathSync.native()`. This avoids surprises from symlinked temp directories and gives callers the canonical path that Git commands are actually using.
