import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { main } from './cli.js';

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

describe('cli main', () => {
  it('maps help and unknown commands to the expected exit codes', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await main(['node', 'repoguide', '--help']);
    expect(process.exitCode).toBe(0);

    process.exitCode = undefined;
    await main(['node', 'repoguide', 'nope']);
    expect(process.exitCode).toBe(2);
    expect(error).not.toHaveBeenCalled();
  });

  it('prints RepoGuideError messages to stderr with exit code 2', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'repoguide-cli-outside-'));
    tempDirs.push(outside);
    vi.spyOn(process, 'cwd').mockReturnValue(outside);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await main(['node', 'repoguide', 'check']);

    expect(process.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/not a git repository|not inside/i));
  });
});
