import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { diffNameStatus, findRepoRoot, hasHead, isInsideGitRepo, latestCommitForPath, listTrackedEntries, listTrackedFiles, stagedChanges, unstagedChanges } from './git.js';

let repo: FixtureRepo | undefined;
let tempDirs: string[] = [];

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe('git utilities', () => {
  it('detects repo roots from nested folders and rejects non-repos clearly', () => {
    repo = createFixtureRepo();
    repo.mkdir('src/deep');
    expect(isInsideGitRepo(repo.root)).toBe(true);
    expect(findRepoRoot(path.join(repo.root, 'src/deep'))).toBe(repo.root);

    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'repoguide-outside-'));
    tempDirs.push(outside);
    expect(isInsideGitRepo(outside)).toBe(false);
    expect(() => findRepoRoot(outside)).toThrow(/not a git repository|not inside/i);
  });

  it('lists only tracked files and preserves paths with spaces', () => {
    repo = createFixtureRepo();
    repo.write('tracked file.txt', 'tracked\n');
    repo.write('untracked.txt', 'nope\n');
    repo.git(['add', 'tracked file.txt']);
    repo.git(['commit', '-m', 'track file']);

    expect(listTrackedFiles(repo.root)).toEqual(['tracked file.txt']);
    expect(listTrackedEntries(repo.root)[0]?.path).toBe('tracked file.txt');
    expect(latestCommitForPath(repo.root, 'tracked file.txt')).toMatch(/[0-9a-f]{40}/);
  });

  it('reports staged, unstaged, rename, delete, and mode-only changes intentionally', () => {
    repo = createFixtureRepo();
    repo.write('a.txt', 'a\n');
    repo.write('b.txt', 'b\n');
    repo.write('script.sh', '#!/bin/sh\n');
    repo.commitAll('initial');
    const base = repo.git(['rev-parse', 'HEAD']).trim();

    repo.write('a.txt', 'a changed\n');
    repo.git(['add', 'a.txt']);
    repo.write('b.txt', 'b changed\n');
    fs.chmodSync(path.join(repo.root, 'script.sh'), 0o755);

    expect(stagedChanges(repo.root).map((change) => change.path)).toContain('a.txt');
    expect(unstagedChanges(repo.root).some((change) => change.path === 'script.sh' && change.status === 'mode-only')).toBe(true);

    repo.git(['commit', '-m', 'change and rename']);
    fs.renameSync(path.join(repo.root, 'script.sh'), path.join(repo.root, 'renamed script.sh'));
    repo.git(['add', '-A']);
    repo.git(['commit', '-m', 'rename script']);
    fs.rmSync(path.join(repo.root, 'b.txt'));
    repo.git(['add', '-A']);
    repo.git(['commit', '-m', 'delete b']);

    const changes = diffNameStatus(repo.root, `${base}..HEAD`);
    expect(changes.some((change) => change.status.startsWith('R') && change.oldPath === 'script.sh' && change.path === 'renamed script.sh')).toBe(true);
    expect(changes.some((change) => change.status === 'D' && change.path === 'b.txt')).toBe(true);
  });

  it('handles empty repos, detached HEAD, and unsupported newline paths intentionally', () => {
    repo = createFixtureRepo();
    expect(hasHead(repo.root)).toBe(false);
    expect(diffNameStatus(repo.root, 'HEAD..HEAD')).toEqual([]);

    repo.write('a.txt', 'a\n');
    repo.commitAll('initial');
    repo.git(['checkout', '--detach', 'HEAD']);
    expect(latestCommitForPath(repo.root, 'a.txt')).toMatch(/[0-9a-f]{40}/);

    repo.git(['checkout', 'main']);
    repo.write('bad\nname.txt', 'bad\n');
    repo.git(['add', 'bad\nname.txt']);
    expect(() => listTrackedEntries(repo.root)).toThrow(/newline/);
  });
});
