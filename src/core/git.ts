import { execFileSync } from 'node:child_process';
import { RepoGuideError } from './errors.js';
import { normalizeRepoPath } from './paths.js';

export interface GitEntry {
  path: string;
  mode: string;
  object: string;
  stage: string;
}

export interface GitChange {
  status: string;
  path: string;
  oldPath?: string;
}

function runGit(args: string[], cwd: string, options: { allowFailure?: boolean } = {}): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    if (options.allowFailure) return '';
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as { stderr?: unknown }).stderr ?? '') : '';
    throw new RepoGuideError(stderr.trim() || `git ${args.join(' ')} failed`);
  }
}

function assertNoNewlinePath(pathValue: string): void {
  if (pathValue.includes('\n') || pathValue.includes('\r')) {
    throw new RepoGuideError(`Unsupported Git path containing a newline: ${JSON.stringify(pathValue)}`);
  }
}

export function findRepoRoot(cwd: string): string {
  const root = runGit(['rev-parse', '--show-toplevel'], cwd).trim();
  if (!root) throw new RepoGuideError('Current directory is not inside a Git repository.');
  return root;
}

export function isInsideGitRepo(cwd: string): boolean {
  return runGit(['rev-parse', '--is-inside-work-tree'], cwd, { allowFailure: true }).trim() === 'true';
}

export function hasHead(repoRoot: string): boolean {
  return runGit(['rev-parse', '--verify', 'HEAD'], repoRoot, { allowFailure: true }).trim().length > 0;
}

export function listTrackedEntries(repoRoot: string): GitEntry[] {
  const raw = execFileSync('git', ['ls-files', '-z', '--stage'], {
    cwd: repoRoot,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const chunks = raw.toString('utf8').split('\0').filter(Boolean);
  return chunks.map((chunk) => {
    assertNoNewlinePath(chunk);
    const match = /^(\d+)\s+([0-9a-f]+)\s+(\d)\t(.+)$/.exec(chunk);
    if (!match) throw new RepoGuideError(`Unable to parse git ls-files entry: ${chunk}`);
    const [, mode, object, stage, rawPath] = match;
    assertNoNewlinePath(rawPath);
    return { mode, object, stage, path: normalizeRepoPath(rawPath) };
  });
}

export function listTrackedFiles(repoRoot: string): string[] {
  return listTrackedEntries(repoRoot).map((entry) => entry.path).sort();
}

export function listVersionedAndUntrackedFiles(repoRoot: string): string[] {
  const raw = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return raw
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map((rawPath) => {
      assertNoNewlinePath(rawPath);
      return normalizeRepoPath(rawPath);
    })
    .sort();
}

export function latestCommitForPath(repoRoot: string, repoPath: string): string | undefined {
  assertNoNewlinePath(repoPath);
  if (!hasHead(repoRoot)) return undefined;
  const commit = runGit(['log', '-n', '1', '--format=%H', '--', repoPath], repoRoot, { allowFailure: true }).trim();
  return commit || undefined;
}

function parseNumstatPaths(raw: string): Set<string> {
  const paths = new Set<string>();
  const tokens = raw.split('\0').filter(Boolean);
  for (const token of tokens) {
    const parts = token.split('\t');
    if (parts[0] === '0' && parts[1] === '0') continue;
    const maybePath = parts.length >= 3 ? parts.slice(2).join('\t') : token;
    if (!maybePath || maybePath.includes('\t')) continue;
    assertNoNewlinePath(maybePath);
    paths.add(normalizeRepoPath(maybePath));
  }
  return paths;
}

function parseNameStatus(raw: string, contentChangedPaths = new Set<string>()): GitChange[] {
  const tokens = raw.split('\0').filter(Boolean);
  const changes: GitChange[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const status = tokens[index] ?? '';
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[++index] ?? '';
      const newPath = tokens[++index] ?? '';
      assertNoNewlinePath(oldPath);
      assertNoNewlinePath(newPath);
      changes.push({ status, oldPath: normalizeRepoPath(oldPath), path: normalizeRepoPath(newPath) });
      continue;
    }
    const changedPath = tokens[++index] ?? '';
    assertNoNewlinePath(changedPath);
    const path = normalizeRepoPath(changedPath);
    changes.push({ status: status === 'M' && !contentChangedPaths.has(path) ? 'mode-only' : status, path });
  }
  return changes;
}

export function diffNameStatus(repoRoot: string, range: string): GitChange[] {
  if (!hasHead(repoRoot)) return [];
  const contentChangedPaths = parseNumstatPaths(runGit(['diff', '--numstat', '-z', range], repoRoot, { allowFailure: true }));
  return parseNameStatus(runGit(['diff', '--name-status', '-z', '--find-renames', range], repoRoot, { allowFailure: true }), contentChangedPaths);
}

export function stagedChanges(repoRoot: string): GitChange[] {
  const contentChangedPaths = parseNumstatPaths(runGit(['diff', '--cached', '--numstat', '-z'], repoRoot, { allowFailure: true }));
  return parseNameStatus(runGit(['diff', '--cached', '--name-status', '-z', '--find-renames'], repoRoot, { allowFailure: true }), contentChangedPaths);
}

export function unstagedChanges(repoRoot: string): GitChange[] {
  const contentChangedPaths = parseNumstatPaths(runGit(['diff', '--numstat', '-z'], repoRoot, { allowFailure: true }));
  return parseNameStatus(runGit(['diff', '--name-status', '-z', '--find-renames'], repoRoot, { allowFailure: true }), contentChangedPaths);
}

export function trackedWorkingTreeChanges(repoRoot: string): GitChange[] {
  return [...stagedChanges(repoRoot), ...unstagedChanges(repoRoot)];
}

export function fileModeChangedOnly(change: GitChange): boolean {
  return change.status === 'mode-only';
}
