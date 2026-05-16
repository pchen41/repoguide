import fs from 'node:fs';
import { GUIDE_FILENAME } from '../constants.js';
import { loadGuideIgnore } from './guideignore.js';
import { diffNameStatus, fileModeChangedOnly, latestCommitForPath, trackedWorkingTreeChanges, type GitChange } from './git.js';
import { absoluteFromRepo, guidePathForFolder, isDescendantOrSelf, isDirectChildFile, isGuidePath } from './paths.js';
import type { FolderNode } from './tree.js';

export interface FreshnessResult {
  needsAttention: boolean;
  missing: boolean;
  stale: boolean;
  reasons: string[];
}

function changePaths(change: GitChange): string[] {
  return [change.path, change.oldPath].filter((value): value is string => Boolean(value));
}

function relevantSourceChange(change: GitChange, folderPath: string, isIgnored: (repoPath: string) => boolean): boolean {
  if (fileModeChangedOnly(change)) return false;
  return changePaths(change).some((changedPath) => isDirectChildFile(changedPath, folderPath) && !isIgnored(changedPath));
}

function relevantChildGuideChange(change: GitChange, folderPath: string): boolean {
  if (fileModeChangedOnly(change)) return false;
  return changePaths(change).some((changedPath) => {
    if (!isGuidePath(changedPath)) return false;
    const guideFolder = changedPath === GUIDE_FILENAME ? '.' : changedPath.slice(0, -`/${GUIDE_FILENAME}`.length);
    return guideFolder !== folderPath && isDescendantOrSelf(guideFolder, folderPath);
  });
}

export function guideHasUncommittedChanges(repoRoot: string, folderPath: string): boolean {
  const guidePath = guidePathForFolder(folderPath);
  return trackedWorkingTreeChanges(repoRoot).some((change) => changePaths(change).includes(guidePath));
}

export function freshnessForFolder(repoRoot: string, folder: FolderNode, eligibleSourceFiles: string[], extraChangedGuides = new Set<string>()): FreshnessResult {
  const guidePath = guidePathForFolder(folder.path);
  const absoluteGuide = absoluteFromRepo(repoRoot, guidePath);
  const reasons: string[] = [];
  if (!fs.existsSync(absoluteGuide)) {
    return { needsAttention: true, missing: true, stale: false, reasons: ['missing guide candidate'] };
  }

  const guideCommit = latestCommitForPath(repoRoot, guidePath);
  if (!guideCommit) {
    return { needsAttention: true, missing: false, stale: true, reasons: ['guide has no Git history'] };
  }

  void eligibleSourceFiles;
  const guideIgnore = loadGuideIgnore(repoRoot);
  const committed = diffNameStatus(repoRoot, `${guideCommit}..HEAD`);
  const working = trackedWorkingTreeChanges(repoRoot);
  const allChanges = [...committed, ...working];

  if (allChanges.some((change) => relevantSourceChange(change, folder.path, guideIgnore.ignored))) {
    reasons.push('direct source changed');
  }
  if (allChanges.some((change) => relevantChildGuideChange(change, folder.path))) {
    reasons.push('descendant guide changed');
  }
  for (const changedGuide of extraChangedGuides) {
    if (changedGuide !== guidePath && isDescendantOrSelf(changedGuide, folder.path)) reasons.push('descendant guide updated in this run');
  }

  const uniqueReasons = [...new Set(reasons)];
  return { needsAttention: uniqueReasons.length > 0, missing: false, stale: uniqueReasons.length > 0, reasons: uniqueReasons };
}
