import { GUIDE_FILENAME } from '../constants.js';
import type { GitEntry } from './git.js';
import { folderOf, guidePathForFolder, isGuidePath, normalizeRepoPath } from './paths.js';

export interface FolderNode {
  path: string;
  directFiles: string[];
  children: string[];
  hasGuide: boolean;
}

export interface FolderTree {
  nodes: Map<string, FolderNode>;
  root: FolderNode;
}

function depthOf(folderPath: string): number {
  return folderPath === '.' ? 0 : folderPath.split('/').length;
}

function ensureNode(nodes: Map<string, FolderNode>, folderPath: string): FolderNode {
  const normalized = normalizeRepoPath(folderPath);
  const existing = nodes.get(normalized);
  if (existing) return existing;
  const node: FolderNode = { path: normalized, directFiles: [], children: [], hasGuide: false };
  nodes.set(normalized, node);
  if (normalized !== '.') {
    const parent = folderOf(normalized);
    const parentNode = ensureNode(nodes, parent);
    if (!parentNode.children.includes(normalized)) parentNode.children.push(normalized);
  }
  return node;
}

export function buildFolderTree(sourceFiles: string[], trackedEntries: GitEntry[]): FolderTree {
  const nodes = new Map<string, FolderNode>();
  ensureNode(nodes, '.');

  for (const file of sourceFiles) {
    const folder = folderOf(file);
    const node = ensureNode(nodes, folder);
    node.directFiles.push(file);
  }

  for (const entry of trackedEntries) {
    if (isGuidePath(entry.path) && entry.path.endsWith(GUIDE_FILENAME)) {
      const folder = folderOf(entry.path);
      ensureNode(nodes, folder).hasGuide = true;
    }
  }

  for (const node of nodes.values()) {
    node.directFiles.sort();
    node.children.sort();
  }

  return { nodes, root: nodes.get('.')! };
}

export function deepestFirst(tree: FolderTree): FolderNode[] {
  return [...tree.nodes.values()].sort((a, b) => {
    const depth = depthOf(b.path) - depthOf(a.path);
    return depth || a.path.localeCompare(b.path);
  });
}

export function rootFirst(tree: FolderTree): FolderNode[] {
  return [...tree.nodes.values()].sort((a, b) => {
    const depth = depthOf(a.path) - depthOf(b.path);
    return depth || a.path.localeCompare(b.path);
  });
}

export function descendants(tree: FolderTree, folderPath: string): FolderNode[] {
  const prefix = folderPath === '.' ? '' : `${folderPath}/`;
  return [...tree.nodes.values()]
    .filter((node) => folderPath === '.' || node.path === folderPath || node.path.startsWith(prefix))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function descendantsDeepestFirst(tree: FolderTree, folderPath: string): FolderNode[] {
  const scoped = descendants(tree, folderPath);
  return scoped.sort((a, b) => {
    const depth = depthOf(b.path) - depthOf(a.path);
    return depth || a.path.localeCompare(b.path);
  });
}

export function ancestors(tree: FolderTree, folderPath: string): FolderNode[] {
  const parts = folderPath === '.' ? [] : folderPath.split('/');
  const paths = ['.'];
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    paths.push(current);
  }
  return paths.map((candidate) => tree.nodes.get(candidate)).filter((node): node is FolderNode => Boolean(node));
}

export function folderHasGuide(node: FolderNode): boolean {
  return node.hasGuide;
}

export function guidePath(node: FolderNode): string {
  return guidePathForFolder(node.path);
}
