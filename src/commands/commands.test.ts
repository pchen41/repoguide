import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFixtureRepo, type FixtureRepo } from '../test-utils/fixture-repo.js';
import { runCheck } from './check.js';
import { runEstimate } from './estimate.js';
import { runInit } from './init.js';
import { runUpdate } from './update.js';
import type { GuideProvider, ProviderResult } from '../llm/provider.js';

let repo: FixtureRepo | undefined;
const savedEnv = new Map<string, string | undefined>();
const envKeys = ['OPENAI_API_KEY', 'REPOGUIDE_MODEL', 'REPOGUIDE_PROVIDER', 'REPOGUIDE_MAX_FILE_BYTES'];

class FakeProvider implements GuideProvider {
  readonly folders: string[] = [];
  constructor(private readonly responses: Record<string, ProviderResult> = {}) {}

  async generateGuide(folderPath: string): Promise<ProviderResult> {
    this.folders.push(folderPath);
    return (
      this.responses[folderPath] ?? {
        type: 'guide',
        markdown: `${folderPath === '.' ? '# .' : `# ${folderPath}`}\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n`
      }
    );
  }
}

function snapshotEnv(): void {
  for (const key of envKeys) savedEnv.set(key, process.env[key]);
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.REPOGUIDE_MODEL = 'test-model';
  process.env.REPOGUIDE_PROVIDER = 'openai';
}

function restoreEnv(): void {
  for (const key of envKeys) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
}

function captureConsole(): { stdout: string[]; stderr: string[]; restore: () => void } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
    stdout.push(String(value));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((value?: unknown) => {
    stderr.push(String(value));
  });
  return {
    stdout,
    stderr,
    restore: () => {
      log.mockRestore();
      error.mockRestore();
    }
  };
}

afterEach(() => {
  repo?.cleanup();
  repo = undefined;
  restoreEnv();
  vi.restoreAllMocks();
});

describe('commands', () => {
  it('init generates deepest folders first and check reports clean after commit', async () => {
    snapshotEnv();
    repo = createFixtureRepo();
    repo.write('src/core/a.ts', 'export const a = 1;\n');
    repo.commitAll('source');
    const provider = new FakeProvider();
    const capture = captureConsole();
    const initResult = await runInit(repo.root, { provider });
    capture.restore();

    expect(initResult.exitCode).toBe(0);
    expect(provider.folders).toEqual(['src/core', 'src', '.']);
    expect(fs.existsSync(`${repo.root}/src/core/guide.md`)).toBe(true);
    expect(capture.stdout.at(-1)).toContain('created=3');

    repo.commitAll('guides');
    const checkCapture = captureConsole();
    const check = await runCheck(repo.root);
    checkCapture.restore();
    expect(check.exitCode).toBe(0);
    expect(checkCapture.stdout).toContain('All guides are fresh.');
  });

  it('check reports stale guides and update refreshes them without touching uncommitted guides', async () => {
    snapshotEnv();
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.write('src/guide.md', '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    repo.commitAll('initial');
    repo.write('src/a.ts', 'changed\n');

    const checkCapture = captureConsole();
    const check = await runCheck(repo.root);
    checkCapture.restore();
    expect(check.exitCode).toBe(1);
    expect(checkCapture.stdout.join('\n')).toContain('direct source changed');

    const provider = new FakeProvider();
    const updateCapture = captureConsole();
    const update = await runUpdate(repo.root, { provider });
    updateCapture.restore();
    expect(update.exitCode).toBe(0);
    expect(provider.folders).toEqual(['src']);
    expect(updateCapture.stdout.at(-1)).toContain('updated=1');

    repo.write('src/guide.md', 'local edit\n');
    const skipCapture = captureConsole();
    await runUpdate(repo.root, { provider });
    skipCapture.restore();
    expect(skipCapture.stdout.join('\n')).toContain('skipped guide with uncommitted changes');
  });

  it('estimate follows real init and update prompt selection without API keys', async () => {
    snapshotEnv();
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.write('src/guide.md', '# src\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    repo.commitAll('initial');
    delete process.env.OPENAI_API_KEY;
    delete process.env.REPOGUIDE_MODEL;

    const initCapture = captureConsole();
    await runEstimate('init', repo.root);
    initCapture.restore();
    expect(initCapture.stdout).toContain('folder_count=1');

    repo.write('src/a.ts', 'changed\n');
    const updateCapture = captureConsole();
    await runEstimate('update', repo.root);
    updateCapture.restore();
    expect(updateCapture.stdout).toContain('folder_count=1');
  });

  it('reports init dry-run, no-guide, and provider failures without writing guides', async () => {
    snapshotEnv();
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.write('docs/readme.md', 'docs\n');
    repo.write('broken/file.txt', 'broken\n');
    repo.commitAll('source');
    const provider = new FakeProvider({
      src: { type: 'no-guide' },
      docs: {
        type: 'guide',
        markdown: '# docs\n\n## Responsibility\n\n## Important Files\n\n## Child Modules\n\n## Notes\n'
      },
      broken: { type: 'error', message: 'provider failed' }
    });

    const dryRunCapture = captureConsole();
    const dryRun = await runInit(repo.root, { provider, dryRun: true });
    dryRunCapture.restore();
    expect(dryRun.exitCode).toBe(1);
    expect(dryRunCapture.stdout.at(-1)).toContain('dry-run=2');
    expect(dryRunCapture.stdout.at(-1)).toContain('no-guide=1');
    expect(dryRunCapture.stdout.at(-1)).toContain('failed=1');
    expect(dryRunCapture.stderr.join('\n')).toContain('provider failed');
    expect(fs.existsSync(`${repo.root}/docs/guide.md`)).toBe(false);
  });

  it('reports update no-guide and dry-run without overwriting guides', async () => {
    snapshotEnv();
    repo = createFixtureRepo();
    repo.write('src/a.ts', 'a\n');
    repo.write('src/guide.md', '# src\n\n## Responsibility\nold\n\n## Important Files\n\n## Child Modules\n\n## Notes\n');
    repo.commitAll('initial');
    repo.write('src/a.ts', 'changed\n');

    const noGuideProvider = new FakeProvider({ src: { type: 'no-guide' } });
    const noGuideCapture = captureConsole();
    const noGuide = await runUpdate(repo.root, { provider: noGuideProvider });
    noGuideCapture.restore();
    expect(noGuide.exitCode).toBe(0);
    expect(noGuideCapture.stdout.join('\n')).toContain('existing guide left unchanged');
    expect(fs.readFileSync(`${repo.root}/src/guide.md`, 'utf8')).toContain('old');

    const dryProvider = new FakeProvider();
    const dryCapture = captureConsole();
    const dry = await runUpdate(repo.root, { provider: dryProvider, dryRun: true });
    dryCapture.restore();
    expect(dry.exitCode).toBe(0);
    expect(dryCapture.stdout.at(-1)).toContain('dry-run=1');
    expect(fs.readFileSync(`${repo.root}/src/guide.md`, 'utf8')).toContain('old');
  });
});
