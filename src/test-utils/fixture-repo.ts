import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export interface FixtureRepo {
  root: string;
  write: (repoPath: string, contents: string | Buffer) => void;
  mkdir: (repoPath: string) => void;
  git: (args: string[]) => string;
  commitAll: (message?: string) => string;
  cleanup: () => void;
}

export function createFixtureRepo(): FixtureRepo {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'repoguide-test-')));
  const git = (args: string[]): string =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  git(['init']);
  git(['config', 'user.email', 'repoguide@example.com']);
  git(['config', 'user.name', 'Repo Guide']);
  git(['config', 'core.filemode', 'true']);

  const mkdir = (repoPath: string): void => {
    fs.mkdirSync(path.join(root, repoPath), { recursive: true });
  };

  const write = (repoPath: string, contents: string | Buffer): void => {
    const absolute = path.join(root, repoPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents);
  };

  return {
    root,
    write,
    mkdir,
    git,
    commitAll: (message = 'fixture commit') => {
      git(['add', '.']);
      return git(['commit', '-m', message]);
    },
    cleanup: () => fs.rmSync(root, { recursive: true, force: true })
  };
}
