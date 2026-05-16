import { describe, expect, it } from 'vitest';
import { ancestorsOf, folderOf, guidePathForFolder, isDescendantOrSelf, normalizeRepoPath } from './paths.js';

describe('paths', () => {
  it('normalizes repo paths and folders', () => {
    expect(normalizeRepoPath('src/../src/app.ts')).toBe('src/app.ts');
    expect(normalizeRepoPath('')).toBe('.');
    expect(folderOf('src/app.ts')).toBe('src');
    expect(folderOf('README.md')).toBe('.');
  });

  it('builds guide paths and ancestry checks', () => {
    expect(guidePathForFolder('.')).toBe('guide.md');
    expect(guidePathForFolder('src/core')).toBe('src/core/guide.md');
    expect(ancestorsOf('src/core')).toEqual(['.', 'src', 'src/core']);
    expect(isDescendantOrSelf('src/core', 'src')).toBe(true);
    expect(isDescendantOrSelf('src2/core', 'src')).toBe(false);
  });

  it('rejects paths that escape the repo', () => {
    expect(() => normalizeRepoPath('../outside')).toThrow(/escapes/);
  });
});
