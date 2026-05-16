import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { buildRepoContext } from './plans.js';
import { freshnessForFolder, guideHasUncommittedChanges } from './stale.js';
import type { FolderNode } from './tree.js';

let repo: FixtureRepo | undefined;

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

function node(folderPath: string): FolderNode {
  return { path: folderPath, directFiles: [], children: [], hasGuide: true };
}

function setupGuidedRepo(): FixtureRepo {
  const fixture = createFixtureRepo();
  fixture.write('src/a.ts', 'export const a = 1;\n');
  fixture.write('src/guide.md', '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
  fixture.write('guide.md', '# .\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
  fixture.commitAll('initial guides');
  return fixture;
}

describe('freshness', () => {
  it('reports missing guides and guides with no Git history', () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.commitAll('source only');
    expect(freshnessForFolder(repo.root, node('src'), ['src/a.ts']).reasons).toEqual(['missing guide candidate']);

    repo.write('src/guide.md', '# src\n');
    const fresh = freshnessForFolder(repo.root, node('src'), ['src/a.ts']);
    expect(fresh.stale).toBe(true);
    expect(fresh.reasons).toEqual(['guide has no Git history']);
  });

  it('marks direct changes, deletes, and renames out as stale', () => {
    repo = setupGuidedRepo();
    repo.write('src/a.ts', 'changed\n');
    expect(freshnessForFolder(repo.root, node('src'), ['src/a.ts']).reasons).toContain('direct source changed');

    repo.git(['checkout', '--', 'src/a.ts']);
    fs.rmSync(path.join(repo.root, 'src/a.ts'));
    repo.git(['add', '-A']);
    repo.git(['commit', '-m', 'delete source']);
    expect(freshnessForFolder(repo.root, node('src'), []).reasons).toContain('direct source changed');

    repo = setupGuidedRepo();
    fs.renameSync(path.join(repo.root, 'src/a.ts'), path.join(repo.root, 'a.ts'));
    repo.git(['add', '-A']);
    repo.git(['commit', '-m', 'rename out']);
    expect(freshnessForFolder(repo.root, node('src'), []).reasons).toContain('direct source changed');
  });

  it('ignores guideignored and mode-only source changes', () => {
    repo = setupGuidedRepo();
    repo.write('.guideignore', 'src/a.ts\n');
    repo.git(['add', '.guideignore']);
    repo.git(['commit', '-m', 'ignore source']);
    repo.write('src/a.ts', 'ignored change\n');
    expect(freshnessForFolder(repo.root, node('src'), []).needsAttention).toBe(false);

    repo.git(['checkout', '--', 'src/a.ts']);
    fs.chmodSync(path.join(repo.root, 'src/a.ts'), 0o755);
    expect(freshnessForFolder(repo.root, node('src'), ['src/a.ts']).needsAttention).toBe(false);
  });

  it('marks parent guides stale when descendant guides change and detects uncommitted guide edits', () => {
    repo = setupGuidedRepo();
    repo.write('src/guide.md', '# src\n\n## Responsibility\nchanged\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    const rootFreshness = freshnessForFolder(repo.root, node('.'), ['src/a.ts']);
    expect(rootFreshness.reasons).toContain('descendant guide changed');
    expect(guideHasUncommittedChanges(repo.root, 'src')).toBe(true);
  });

  it('works with repo context source filtering', () => {
    repo = setupGuidedRepo();
    const context = buildRepoContext(repo.root, repo.root);
    expect(context.sourceFiles).toEqual(['src/a.ts']);
    expect(context.tree.nodes.get('src')?.hasGuide).toBe(true);
  });

  it('does not mark CRLF working-tree rewrites stale when Git reports no content change', () => {
    repo = createFixtureRepo();
    repo.write('.gitattributes', 'src/a.txt text eol=lf\n');
    repo.write('src/a.txt', 'one\ntwo\n');
    repo.write('src/guide.md', '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    repo.commitAll('lf source and guide');

    repo.write('src/a.txt', 'one\r\ntwo\r\n');
    expect(repo.git(['diff', '--name-status']).trim()).toBe('');
    expect(freshnessForFolder(repo.root, node('src'), ['src/a.txt']).needsAttention).toBe(false);
  });
});
