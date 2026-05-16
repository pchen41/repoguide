import path from 'node:path';
import { RepoGuideError } from './errors.js';

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

export function normalizeRepoPath(value: string): string {
  const normalized = toPosixPath(path.posix.normalize(toPosixPath(value)));
  if (normalized === '.' || normalized === '') return '.';
  if (normalized.startsWith('../') || normalized === '..') {
    throw new RepoGuideError(`Path escapes repository: ${value}`);
  }
  return normalized.replace(/^.\//, '');
}

export function folderOf(repoPath: string): string {
  const normalized = normalizeRepoPath(repoPath);
  const dir = path.posix.dirname(normalized);
  return dir === '.' ? '.' : dir;
}

export function joinRepoPath(...parts: string[]): string {
  const filtered = parts.filter((part) => part !== '.' && part.length > 0);
  return normalizeRepoPath(filtered.length === 0 ? '.' : path.posix.join(...filtered));
}

export function isGuidePath(repoPath: string): boolean {
  return path.posix.basename(repoPath) === 'guide.md';
}

export function guidePathForFolder(folderPath: string): string {
  return folderPath === '.' ? 'guide.md' : `${folderPath}/guide.md`;
}

export function isDescendantOrSelf(candidate: string, folderPath: string): boolean {
  if (folderPath === '.') return true;
  return candidate === folderPath || candidate.startsWith(`${folderPath}/`);
}

export function isDirectChildFile(filePath: string, folderPath: string): boolean {
  return folderOf(filePath) === folderPath;
}

export function ancestorsOf(folderPath: string): string[] {
  const normalized = normalizeRepoPath(folderPath);
  const ancestors: string[] = ['.'];
  if (normalized === '.') return ancestors;
  const parts = normalized.split('/');
  let current = '';
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    ancestors.push(current);
  }
  return ancestors;
}

export function parentFoldersBottomUp(folderPath: string): string[] {
  return ancestorsOf(folderPath).reverse();
}

export function absoluteFromRepo(repoRoot: string, repoPath: string): string {
  return repoPath === '.' ? repoRoot : path.join(repoRoot, ...repoPath.split('/'));
}
