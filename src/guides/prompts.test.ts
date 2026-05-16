import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { buildFolderTree } from '../core/tree.js';
import { buildGuidePrompt } from './prompts.js';
import type { GitEntry } from '../core/git.js';

let repo: FixtureRepo | undefined;

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
});

function entry(path: string, mode = '100644'): GitEntry {
  return { path, mode, object: 'abc', stage: '0' };
}

describe('prompt builder', () => {
  it('includes direct files, child guides, skipped notes, and truncation notes', () => {
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'export const a = 1;\n');
    repo.write('src/child/guide.md', '# src/child\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    repo.write('src/large.txt', 'x'.repeat(50));
    fs.symlinkSync('/tmp/outside', `${repo.root}/src/link`);
    const entries = [entry('src/a.ts'), entry('src/large.txt'), entry('src/link', '120000'), entry('src/child/guide.md')];
    const tree = buildFolderTree(['src/a.ts', 'src/large.txt', 'src/link'], entries);
    const folder = tree.nodes.get('src');
    expect(folder).toBeDefined();
    const result = buildGuidePrompt({
      repoRoot: repo.root,
      folder: folder!,
      tree,
      gitEntries: new Map(entries.map((item) => [item.path, item])),
      maxFileBytes: 25,
      promptBudgetChars: 1200
    });
    expect(result.prompt).toContain('File src/a.ts');
    expect(result.prompt).toContain('Child guide src/child/guide.md');
    expect(result.skippedNotes.join('\n')).toContain('src/large.txt skipped');
    expect(result.skippedNotes.join('\n')).toContain('src/link skipped: symlink');
    expect(result.characterCount).toBeLessThanOrEqual(1200);
  });

  it('reports binary, invalid UTF-8, submodule, and aggregate truncation notes deterministically', () => {
    repo = createFixtureRepo();
    repo.write('src/binary.dat', Buffer.from([0, 1, 2]));
    repo.write('src/invalid.txt', Buffer.from([0xc3, 0x28]));
    repo.write('src/long.txt', `${'x'.repeat(200)}\n`);
    const entries = [entry('src/binary.dat'), entry('src/invalid.txt'), entry('src/vendor-lib', '160000'), entry('src/long.txt')];
    const tree = buildFolderTree(['src/binary.dat', 'src/invalid.txt', 'src/vendor-lib', 'src/long.txt'], entries);
    const result = buildGuidePrompt({
      repoRoot: repo.root,
      folder: tree.nodes.get('src')!,
      tree,
      gitEntries: new Map(entries.map((item) => [item.path, item])),
      maxFileBytes: 1000,
      promptBudgetChars: 620
    });

    expect(result.skippedNotes).toContain('src/binary.dat skipped: binary file.');
    expect(result.skippedNotes).toContain('src/invalid.txt skipped: invalid UTF-8.');
    expect(result.skippedNotes).toContain('src/vendor-lib skipped: submodule gitlink.');
    expect(result.truncatedNotes.some((note) => note.includes('file src/long.txt'))).toBe(true);
    expect(result.characterCount).toBeLessThanOrEqual(620);
  });
});
