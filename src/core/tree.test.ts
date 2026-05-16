import { describe, expect, it } from 'vitest';
import { ancestors, buildFolderTree, deepestFirst, descendants, folderHasGuide, guidePath, rootFirst } from './tree.js';
import type { GitEntry } from './git.js';

function entry(path: string): GitEntry {
  return { path, mode: '100644', object: 'abc', stage: '0' };
}

describe('folder tree', () => {
  it('represents source folders and existing guides deterministically', () => {
    const tree = buildFolderTree(['README.md', 'src/a.ts', 'src/core/b.ts'], [entry('README.md'), entry('src/a.ts'), entry('src/core/b.ts'), entry('src/core/guide.md')]);
    expect(tree.nodes.get('.')?.directFiles).toEqual(['README.md']);
    expect(tree.nodes.get('src')?.children).toEqual(['src/core']);
    expect(tree.nodes.get('src/core')?.hasGuide).toBe(true);
    expect(rootFirst(tree).map((node) => node.path)).toEqual(['.', 'src', 'src/core']);
    expect(deepestFirst(tree).map((node) => node.path)).toEqual(['src/core', 'src', '.']);
    expect(descendants(tree, 'src').map((node) => node.path)).toEqual(['src', 'src/core']);
    expect(ancestors(tree, 'src/core').map((node) => node.path)).toEqual(['.', 'src', 'src/core']);
    expect(folderHasGuide(tree.nodes.get('src/core')!)).toBe(true);
    expect(guidePath(tree.nodes.get('src/core')!)).toBe('src/core/guide.md');
  });

  it('keeps folders with existing guides even without eligible source files', () => {
    const tree = buildFolderTree([], [entry('docs/guide.md')]);
    expect(rootFirst(tree).map((node) => node.path)).toEqual(['.', 'docs']);
    expect(tree.nodes.get('docs')?.hasGuide).toBe(true);
  });
});
