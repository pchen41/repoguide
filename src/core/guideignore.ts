import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { GUIDE_FILENAME } from '../constants.js';
import { isGuidePath } from './paths.js';

export interface GuideIgnore {
  readonly ignored: (repoPath: string) => boolean;
  readonly filterSourceFiles: (repoPaths: string[]) => string[];
}

export function loadGuideIgnore(repoRoot: string): GuideIgnore {
  const ig = ignore();
  const guideIgnorePath = path.join(repoRoot, '.guideignore');
  if (fs.existsSync(guideIgnorePath)) {
    ig.add(fs.readFileSync(guideIgnorePath, 'utf8'));
  }

  const ignored = (repoPath: string): boolean => {
    if (isGuidePath(repoPath)) return true;
    if (repoPath === '.guideignore') return true;
    return ig.ignores(repoPath);
  };

  return {
    ignored,
    filterSourceFiles(repoPaths: string[]): string[] {
      return [...repoPaths].sort().filter((repoPath) => !ignored(repoPath));
    }
  };
}
