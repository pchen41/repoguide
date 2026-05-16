import fs from 'node:fs';
import path from 'node:path';
import { loadGuideIgnore } from './guideignore.js';
import { listTrackedEntries } from './git.js';
import { buildFolderTree, descendantsDeepestFirst, type FolderNode, type FolderTree } from './tree.js';
import { ancestorsOf, normalizeRepoPath, toPosixPath } from './paths.js';
import { freshnessForFolder } from './stale.js';

export interface RepoContext {
  repoRoot: string;
  cwd: string;
  trackedEntries: ReturnType<typeof listTrackedEntries>;
  gitEntryMap: Map<string, ReturnType<typeof listTrackedEntries>[number]>;
  sourceFiles: string[];
  tree: FolderTree;
}

export function buildRepoContext(repoRoot: string, cwd: string): RepoContext {
  const trackedEntries = listTrackedEntries(repoRoot);
  const guideIgnore = loadGuideIgnore(repoRoot);
  const sourceFiles = guideIgnore.filterSourceFiles(trackedEntries.map((entry) => entry.path));
  const tree = buildFolderTree(sourceFiles, trackedEntries);
  return {
    repoRoot,
    cwd,
    trackedEntries,
    gitEntryMap: new Map(trackedEntries.map((entry) => [entry.path, entry])),
    sourceFiles,
    tree
  };
}

export function repoRelativeFolder(repoRoot: string, cwd: string): string {
  const realRepoRoot = fs.realpathSync.native(repoRoot);
  const realCwd = fs.realpathSync.native(cwd);
  const relative = toPosixPath(path.relative(realRepoRoot, realCwd));
  return normalizeRepoPath(relative || '.');
}

export function initPlan(context: RepoContext): FolderNode[] {
  return descendantsDeepestFirst(context.tree, '.');
}

export function checkPlan(context: RepoContext, currentFolder: string): FolderNode[] {
  const folders = new Map<string, FolderNode>();
  for (const node of descendantsDeepestFirst(context.tree, currentFolder)) folders.set(node.path, node);
  for (const ancestor of ancestorsOf(currentFolder)) {
    const node = context.tree.nodes.get(ancestor);
    if (node) folders.set(node.path, node);
  }
  return [...folders.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function updatePlan(context: RepoContext, currentFolder: string): { child: FolderNode[]; parent: FolderNode[] } {
  const child = descendantsDeepestFirst(context.tree, currentFolder);
  const childPaths = new Set(child.map((node) => node.path));
  const parent = ancestorsOf(currentFolder)
    .reverse()
    .map((folder) => context.tree.nodes.get(folder))
    .filter((node): node is FolderNode => node !== undefined)
    .filter((node) => !childPaths.has(node.path));
  return { child, parent };
}

export function staleFolders(context: RepoContext, folders: FolderNode[], extraChangedGuides = new Set<string>()): FolderNode[] {
  return folders.filter((folder) => freshnessForFolder(context.repoRoot, folder, context.sourceFiles, extraChangedGuides).needsAttention);
}
