import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadGuideIgnore } from './guideignore.js';

let dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoguide-ignore-'));
  dirs.push(dir);
  return dir;
}

describe('.guideignore', () => {
  it('excludes guide files and tool config by default', () => {
    const ig = loadGuideIgnore(tempDir());
    expect(ig.filterSourceFiles(['guide.md', 'src/guide.md', '.guideignore', 'src/app.ts'])).toEqual(['src/app.ts']);
  });

  it('applies gitignore patterns and negation order', () => {
    const root = tempDir();
    fs.writeFileSync(path.join(root, '.guideignore'), '# build outputs\n\ndist/\n*.snap\n!keep.snap\nexact.txt\n');
    const ig = loadGuideIgnore(root);
    expect(ig.filterSourceFiles(['dist/app.js', 'a.snap', 'keep.snap', 'exact.txt', 'src/app.ts'])).toEqual(['keep.snap', 'src/app.ts']);
  });
});
